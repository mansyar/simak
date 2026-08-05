import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useCallback, useId, type ChangeEvent, type DragEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { bulkCreateTemplates } from '@/server/bulk-import';
import { parseTemplatesXlsx } from '@/lib/bulk-import/parse-templates';
import { generateTemplateSampleXlsx } from '@/lib/bulk-import/samples';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Upload, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const Route = createFileRoute('/_authenticated/admin/templates/import')({
  component: BulkTemplateImportPage,
});

interface ImportResult {
  created: number;
  skipped: number;
  errors: { templateName: string; reason: string }[];
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
  const fileInputId = useId();
  const bulkCreateTemplatesFn = useServerFn(bulkCreateTemplates);

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedGroups, setParsedGroups] = useState<TemplateGroup[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const validateFile = useCallback(
    (file: File): string | null => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (extension !== '.xlsx') {
        return t('bulkImport.common.invalidFormat');
      }
      if (file.size > MAX_FILE_SIZE) {
        return t('bulkImport.common.fileTooLarge');
      }
      return null;
    },
    [t],
  );

  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setParsedGroups([]);
        setParseErrors([]);
        setRetryFile(null);
        return;
      }
      setValidationError(null);
      setRetryFile(null);
      setIsParsing(true);

      try {
        const parsed = await parseTemplatesXlsx(file);

        if (parsed.errors.length > 0) {
          setParseErrors(parsed.errors);
        }

        setParsedGroups(parsed.groups);
      } catch {
        setValidationError(t('bulkImport.common.parseFailed'));
        setRetryFile(file);
      } finally {
        setIsParsing(false);
      }
    },
    [validateFile, t],
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
      if (isServerError(response)) {
        setValidationError(t('bulkImport.common.importFailed'));
      } else {
        setResult(response);
      }
    } catch {
      setValidationError(t('bulkImport.common.importFailed'));
    } finally {
      setIsCommitting(false);
    }
  }, [parsedGroups, bulkCreateTemplatesFn, t]);

  const validCount = parsedGroups.filter((g) => g.status === 'valid').length;
  const invalidCount = parsedGroups.filter((g) => g.status === 'invalid').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('bulkImport.templates.title')}
        subtitle={t('bulkImport.templates.subtitle')}
      />

      {/* Download sample */}
      <div>
        <Button variant="outline" size="sm" onClick={handleDownloadSample}>
          <Download className="mr-2 h-4 w-4" />
          {t('bulkImport.common.downloadSample')}
        </Button>
      </div>

      {/* Dropzone */}
      <label
        htmlFor={fileInputId}
        data-testid="bulk-import-dropzone"
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          id={fileInputId}
          data-testid="bulk-import-dropzone-input"
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isParsing}
        />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{t('bulkImport.common.dropzoneText')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('bulkImport.common.dropzoneHint')}</p>
      </label>

      {isParsing && (
        <div role="status" aria-live="polite" aria-busy="true">
          {t('bulkImport.common.parsing')}
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <AlertBanner variant="error" title={t('bulkImport.common.error')}>
          {validationError}
        </AlertBanner>
      )}

      {retryFile && !isParsing && (
        <Button type="button" variant="outline" onClick={() => processFile(retryFile)}>
          {t('common.retry')}
        </Button>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <AlertBanner variant="warning" title={t('bulkImport.common.validationErrors')}>
          {parseErrors.length} {t('bulkImport.common.validationErrorsFoundGroups')}
        </AlertBanner>
      )}

      {/* Preview grouped table */}
      {parsedGroups.length > 0 && !result && (
        <div className="space-y-4">
          <div role="status" aria-live="polite" className="flex items-center gap-4 text-sm">
            <span className="text-success">
              {validCount} {t('bulkImport.common.valid')}
            </span>
            <span className="text-error">
              {invalidCount} {t('bulkImport.common.invalid')}
            </span>
          </div>

          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('bulkImport.templates.previewCaption')}</caption>
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th scope="col" className="p-2 text-left w-8"></th>
                  <th scope="col" className="p-2 text-left">
                    {t('bulkImport.templates.templateName')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('bulkImport.templates.type')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('bulkImport.templates.checkpoints')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('bulkImport.common.status')}
                  </th>
                </tr>
              </thead>
              {parsedGroups.map((group, i) => {
                const isExpanded = expandedGroups.has(group.templateName);
                const detailsId = `template-group-${i}-details`;
                return (
                  <React.Fragment key={i}>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-1">
                          <button
                            type="button"
                            className="flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={group.templateName}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() => toggleGroup(group.templateName)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 font-medium">{group.templateName}</td>
                        <td className="p-2">{group.type || '—'}</td>
                        <td className="p-2">{group.checkpoints.length}</td>
                        <td className="p-2">
                          <span
                            data-testid={`group-status-${i}`}
                            className={group.status === 'valid' ? 'text-success' : 'text-error'}
                          >
                            {group.status === 'valid'
                              ? t('bulkImport.common.valid')
                              : t('bulkImport.common.invalid')}
                            {group.error ? ` — ${group.error}` : ''}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    <tbody id={detailsId} hidden={!isExpanded}>
                      {group.checkpoints.map((cp, j) => (
                        <tr key={`cp-${j}`} className="border-t bg-muted/50">
                          <td className="p-2"></td>
                          <td className="p-2 pl-8" colSpan={2}>
                            {cp.name}
                          </td>
                          <td className="p-2">
                            {t('bulkImport.templates.minEst', {
                              min: String(cp.minConsultations),
                              est: String(cp.estimatedDuration),
                            })}
                          </td>
                          <td className="p-2"></td>
                        </tr>
                      ))}
                    </tbody>
                  </React.Fragment>
                );
              })}
            </table>
          </div>

          <Button
            data-testid="import-button"
            onClick={handleCommit}
            disabled={validCount === 0 || isCommitting}
            loading={isCommitting}
          >
            {t('bulkImport.templates.importButton', { count: String(validCount) })}
          </Button>
        </div>
      )}

      {/* Result report */}
      {result && (
        <div className="space-y-4">
          <AlertBanner variant="success" title={t('bulkImport.common.importComplete')}>
            {t('bulkImport.templates.createdSkipped', {
              created: String(result.created),
              skipped: String(result.skipped),
            })}
          </AlertBanner>

          {result.errors.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('bulkImport.templates.resultCaption')}</caption>
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="p-2 text-left">
                      {t('bulkImport.templates.templateName')}
                    </th>
                    <th scope="col" className="p-2 text-left">
                      {t('bulkImport.common.reason')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i} className="border-t">
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
