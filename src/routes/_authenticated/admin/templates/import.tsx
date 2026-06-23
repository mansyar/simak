import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { bulkCreateTemplates } from '@/server/bulk-import';
import { parseTemplatesXlsx } from '@/lib/bulk-import/parse-templates';
import { generateTemplateSampleXlsx } from '@/lib/bulk-import/samples';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Upload, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../__root';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const Route = createFileRoute('/_authenticated/admin/templates/import')({
  component: BulkTemplateImportPage,
});

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; templateName: string; reason: string }[];
}

interface TemplateGroup {
  templateName: string;
  type: string;
  checkpoints: { name: string; minConsultations: number; estimatedDuration: number }[];
  status: 'valid' | 'invalid';
  error?: string;
}

function BulkTemplateImportPage() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkCreateTemplatesFn = useServerFn(bulkCreateTemplates);

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedGroups, setParsedGroups] = useState<TemplateGroup[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const validateFile = useCallback((file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (extension !== '.xlsx') {
      return 'Only .xlsx files are accepted';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be under 5MB';
    }
    return null;
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setParsedGroups([]);
        setParseErrors([]);
        return;
      }
      setValidationError(null);

      try {
        const parsed = await parseTemplatesXlsx(file);

        if (parsed.errors.length > 0) {
          setParseErrors(parsed.errors);
        }

        setParsedGroups(parsed.groups);
      } catch {
        setValidationError('Failed to parse xlsx file');
      }
    },
    [validateFile],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDownloadSample = useCallback(() => {
    const blob = generateTemplateSampleXlsx();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-sample.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    const validGroups = parsedGroups.filter((g) => g.status === 'valid');
    if (validGroups.length === 0) return;

    // Flatten groups into rows for the server
    const rows = validGroups.flatMap((g) =>
      g.checkpoints.map((cp) => ({
        templateName: g.templateName,
        type: g.type,
        checkpointName: cp.name,
        minConsultations: cp.minConsultations,
        estimatedDuration: cp.estimatedDuration,
      })),
    );

    setIsCommitting(true);
    try {
      const response = await bulkCreateTemplatesFn({ data: { rows } });
      if (response.error) {
        setValidationError(String(response.error));
      } else {
        setResult(response as unknown as ImportResult);
      }
    } catch {
      setValidationError('Import failed. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  }, [parsedGroups, bulkCreateTemplatesFn]);

  const validCount = parsedGroups.filter((g) => g.status === 'valid').length;
  const invalidCount = parsedGroups.filter((g) => g.status === 'invalid').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Import Templates"
        subtitle="Upload an .xlsx file to import templates in bulk"
      />

      {/* Download sample */}
      <div>
        <Button variant="outline" size="sm" onClick={handleDownloadSample}>
          <Download className="mr-2 h-4 w-4" />
          Download Sample File
        </Button>
      </div>

      {/* Dropzone */}
      <div
        data-testid="bulk-import-dropzone"
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          data-testid="bulk-import-dropzone-input"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drag & drop an .xlsx file here, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Maximum 500 rows, 5MB file size</p>
      </div>

      {/* Validation error */}
      {validationError && (
        <AlertBanner variant="error" title="Error">
          {validationError}
        </AlertBanner>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <AlertBanner variant="warning" title="Validation Errors">
          {parseErrors.length} validation error(s) found. Invalid groups will be skipped.
        </AlertBanner>
      )}

      {/* Preview grouped table */}
      {parsedGroups.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600">{validCount} valid</span>
            <span className="text-red-600">{invalidCount} invalid</span>
          </div>

          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Template Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Checkpoints</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedGroups.map((group, i) => (
                  <React.Fragment key={i}>
                    <tr
                      className="border-t cursor-pointer"
                      onClick={() => toggleGroup(group.templateName)}
                    >
                      <td className="p-2">
                        {expandedGroups.has(group.templateName) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="p-2 font-medium">{group.templateName}</td>
                      <td className="p-2">{group.type || '—'}</td>
                      <td className="p-2">{group.checkpoints.length}</td>
                      <td className="p-2">
                        <span
                          data-testid={`group-status-${i}`}
                          className={group.status === 'valid' ? 'text-green-600' : 'text-red-600'}
                        >
                          {group.status === 'valid' ? 'Valid' : 'Invalid'}
                          {group.error ? ` — ${group.error}` : ''}
                        </span>
                      </td>
                    </tr>
                    {expandedGroups.has(group.templateName) &&
                      group.checkpoints.map((cp, j) => (
                        <tr key={`cp-${j}`} className="border-t bg-muted/50">
                          <td className="p-2"></td>
                          <td className="p-2 pl-8" colSpan={2}>
                            {cp.name}
                          </td>
                          <td className="p-2">
                            Min: {cp.minConsultations}, Est: {cp.estimatedDuration}d
                          </td>
                          <td className="p-2"></td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            data-testid="import-button"
            onClick={handleCommit}
            disabled={validCount === 0 || isCommitting}
            loading={isCommitting}
          >
            Import {validCount} Templates
          </Button>
        </div>
      )}

      {/* Result report */}
      {result && (
        <div className="space-y-4">
          <AlertBanner variant="success" title="Import Complete">
            {result.created} created, {result.skipped} skipped.
          </AlertBanner>

          {result.errors.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Row</th>
                    <th className="p-2 text-left">Template Name</th>
                    <th className="p-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{err.row}</td>
                      <td className="p-2">{err.templateName}</td>
                      <td className="p-2">{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
