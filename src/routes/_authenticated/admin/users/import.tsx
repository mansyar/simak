import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { bulkCreateUsers } from '@/server/bulk-import';
import { getSessionFromHeaders } from '@/server/auth';
import { parseUsersXlsx } from '@/lib/bulk-import/parse-users';
import { generateUserSampleXlsx } from '@/lib/bulk-import/samples';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Upload, Download, Loader2 } from 'lucide-react';
import { useI18n } from '../../../__root';
import { isServerError } from '@/lib/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const Route = createFileRoute('/_authenticated/admin/users/import')({
  component: BulkUserImportPage,
  loader: async () => {
    const session = await getSessionFromHeaders();
    return { userRole: session?.user.role ?? 'admin' };
  },
  pendingComponent: () => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
}

function BulkUserImportPage() {
  const { t } = useI18n();
  const { userRole } = Route.useLoaderData();
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
        setParsedRows([]);
        setParseErrors([]);
        return;
      }
      setValidationError(null);

      try {
        const parsed = await parseUsersXlsx(file, userRole);

        if (parsed.errors.length > 0) {
          setParseErrors(parsed.errors);
        }

        setParsedRows(parsed.rows);
      } catch {
        setValidationError(t('bulkImport.common.parseFailed'));
      }
    },
    [validateFile, t, userRole],
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
      .map(({ status: _status, error: _error, ...row }) => ({
        ...row,
        role: row.role as 'admin' | 'instructor' | 'student',
      }));

    if (validRows.length === 0) return;

    setIsCommitting(true);
    try {
      const response = await bulkCreateUsersFn({ data: { rows: validRows } });
      if (isServerError(response)) {
        setValidationError(response.error.message);
      } else {
        setResult(response);
      }
    } catch {
      setValidationError(t('bulkImport.common.importFailed'));
    } finally {
      setIsCommitting(false);
    }
  }, [parsedRows, bulkCreateUsersFn, t]);

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="space-y-6">
      <PageHeader title={t('bulkImport.users.title')} subtitle={t('bulkImport.users.subtitle')} />

      {/* Download sample */}
      <div>
        <Button variant="outline" size="sm" onClick={handleDownloadSample}>
          <Download className="mr-2 h-4 w-4" />
          {t('bulkImport.common.downloadSample')}
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
        <p className="mt-2 text-sm text-muted-foreground">{t('bulkImport.common.dropzoneText')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('bulkImport.common.dropzoneHint')}</p>
      </div>

      {/* Validation error */}
      {validationError && (
        <AlertBanner variant="error" title={t('bulkImport.common.error')}>
          {validationError}
        </AlertBanner>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <AlertBanner variant="warning" title={t('bulkImport.common.validationErrors')}>
          {parseErrors.length} {t('bulkImport.common.validationErrorsFound')}
        </AlertBanner>
      )}

      {/* Preview table */}
      {parsedRows.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600">
              {validCount} {t('bulkImport.common.valid')}
            </span>
            <span className="text-red-600">
              {invalidCount} {t('bulkImport.common.invalid')}
            </span>
          </div>

          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">{t('bulkImport.users.name')}</th>
                  <th className="p-2 text-left">{t('bulkImport.users.email')}</th>
                  <th className="p-2 text-left">{t('bulkImport.users.role')}</th>
                  <th className="p-2 text-left">{t('bulkImport.common.status')}</th>
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
                        {row.status === 'valid'
                          ? t('bulkImport.common.valid')
                          : t('bulkImport.common.invalid')}
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
            {t('bulkImport.users.importButton', { count: String(validCount) })}
          </Button>
        </div>
      )}

      {/* Result report */}
      {result && (
        <div className="space-y-4">
          <AlertBanner variant="success" title={t('bulkImport.common.importComplete')}>
            {t('bulkImport.users.createdSkipped', {
              created: String(result.created),
              skipped: String(result.skipped),
            })}
          </AlertBanner>

          {result.errors.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">{t('bulkImport.common.row')}</th>
                    <th className="p-2 text-left">{t('bulkImport.users.email')}</th>
                    <th className="p-2 text-left">{t('bulkImport.common.reason')}</th>
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
