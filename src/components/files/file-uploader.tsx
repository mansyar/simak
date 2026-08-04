import { useState, useRef, useCallback, useId, type ChangeEvent, type DragEvent } from 'react';
import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = ['.docx', '.pdf'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface FileUploaderProps {
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string | null;
  uploadSuccess?: boolean;
  onResetSuccess?: () => void;
}

export function FileUploader({
  onUploadSuccess,
  isUploading = false,
  uploadProgress,
  uploadError = null,
  uploadSuccess = false,
  onResetSuccess,
}: FileUploaderProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = useCallback(
    (file: File): string | null => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(extension)) {
        return t('files.validation.invalidType');
      }
      if (file.size > MAX_FILE_SIZE) {
        return t('files.validation.fileTooLarge');
      }
      return null;
    },
    [t],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        return;
      }
      setValidationError(null);
      setSelectedFile(file);
    },
    [validateFile],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    await onUploadSuccess(selectedFile);
  }, [selectedFile, onUploadSuccess]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onResetSuccess?.();
  }, [onResetSuccess]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {uploadSuccess ? (
        <div
          data-testid="drop-zone"
          className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-green-500 bg-green-50 p-8 dark:bg-green-950/20"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {t('files.uploadSuccess')}
            </p>
            <Button variant="outline" size="sm" type="button" onClick={handleReset}>
              {t('files.uploadAnother')}
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={fileInputId}
          data-testid="drop-zone"
          onClick={(event) => {
            if (event.target !== fileInputRef.current) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative flex cursor-pointer flex-col items-center justify-center
            rounded-lg border-2 border-dashed p-8 transition-colors
            focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2
            ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
            ${uploadError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".docx,.pdf"
            data-testid="file-input"
            aria-label={t('files.dropzone.title')}
            onChange={handleInputChange}
            className="sr-only"
          />
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('files.dropzone.title')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('files.dropzone.subtitle')}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            .docx, .pdf &middot; {t('files.maxSize')}
          </p>
        </label>
      )}

      {/* Selected file info */}
      {selectedFile && !uploadSuccess && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <>
                {uploadProgress === undefined && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('files.uploading')}
              </>
            ) : (
              t('files.upload')
            )}
          </Button>
        </div>
      )}

      {/* Upload progress bar */}
      {isUploading && uploadProgress !== undefined && <Progress value={uploadProgress} showValue />}

      {/* Validation error */}
      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="ml-auto"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {t('files.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
