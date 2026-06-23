import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { bulkCreateUsers } from '@/server/bulk-import';
import { parseUsersXlsx } from '@/lib/bulk-import/parse-users';
import { generateUserSampleXlsx } from '@/lib/bulk-import/samples';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Upload, Download } from 'lucide-react';
import { useI18n } from '../../../__root';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const Route = createFileRoute('/_authenticated/admin/users/import')({
  component: BulkUserImportPage,
});

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
}

function BulkUserImportPage() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkCreateUsersFn = useServerFn(bulkCreateUsers);

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<
    { name: string; email: string; role: string; status: 'valid' | 'invalid'; error?: string }[]
  >([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

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
        setParsedRows([]);
        setParseErrors([]);
        return;
      }
      setValidationError(null);

      try {
        const parsed = await parseUsersXlsx(file, 'admin');

        if (parsed.errors.length > 0) {
          setParseErrors(parsed.errors);
        }

        setParsedRows(parsed.rows);
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
    const blob = generateUserSampleXlsx();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-sample.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCommit = useCallback(async () => {
    const validRows = parsedRows
      .filter((r) => r.status === 'valid')
      .map(({ status, error: _error, ...row }) => ({
        ...row,
        role: row.role as 'admin' | 'instructor' | 'student',
      }));

    if (validRows.length === 0) return;

    setIsCommitting(true);
    try {
      const response = await bulkCreateUsersFn({ data: { rows: validRows } });
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
  }, [parsedRows, bulkCreateUsersFn]);

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Import Users"
        subtitle="Upload an .xlsx file to import users in bulk"
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
          {parseErrors.length} validation error(s) found. Invalid rows will be skipped.
        </AlertBanner>
      )}

      {/* Preview table */}
      {parsedRows.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600">{validCount} valid</span>
            <span className="text-red-600">{invalidCount} invalid</span>
          </div>

          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2">{row.role}</td>
                    <td className="p-2">
                      <span
                        data-testid={`row-status-${i}`}
                        className={row.status === 'valid' ? 'text-green-600' : 'text-red-600'}
                      >
                        {row.status === 'valid' ? 'Valid' : 'Invalid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={handleCommit}
            disabled={validCount === 0 || isCommitting}
            loading={isCommitting}
          >
            Import {validCount} Users
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
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{err.row}</td>
                      <td className="p-2">{err.email}</td>
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
