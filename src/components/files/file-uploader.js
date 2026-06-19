import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback } from 'react';
import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
const ACCEPTED_TYPES = ['.docx', '.pdf'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export function FileUploader({
  onUploadSuccess,
  isUploading = false,
  uploadError = null,
  uploadSuccess = false,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const validateFile = useCallback(
    (file) => {
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
    (file) => {
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
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (e) => {
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
  }, []);
  return _jsxs('div', {
    className: 'space-y-4',
    children: [
      _jsxs('div', {
        'data-testid': 'drop-zone',
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onClick: () => fileInputRef.current?.click(),
        className: `
          relative flex cursor-pointer flex-col items-center justify-center
          rounded-lg border-2 border-dashed p-8 transition-colors
          ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
          ${uploadSuccess ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
          ${uploadError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}
        `,
        children: [
          _jsx('input', {
            ref: fileInputRef,
            type: 'file',
            accept: '.docx,.pdf',
            'data-testid': 'file-input',
            onChange: handleInputChange,
            className: 'hidden',
          }),
          uploadSuccess
            ? _jsxs('div', {
                className: 'flex flex-col items-center gap-2 text-center',
                children: [
                  _jsx(CheckCircle2, { className: 'h-10 w-10 text-green-500' }),
                  _jsx('p', {
                    className: 'text-sm font-medium text-green-700 dark:text-green-300',
                    children: t('files.uploadSuccess'),
                  }),
                  _jsx(Button, {
                    variant: 'outline',
                    size: 'sm',
                    type: 'button',
                    onClick: (e) => {
                      e.stopPropagation();
                      handleReset();
                    },
                    children: t('files.uploadAnother'),
                  }),
                ],
              })
            : _jsxs(_Fragment, {
                children: [
                  _jsx(Upload, { className: 'mb-2 h-8 w-8 text-muted-foreground' }),
                  _jsx('p', {
                    className: 'text-sm font-medium text-foreground',
                    children: t('files.dropzone.title'),
                  }),
                  _jsx('p', {
                    className: 'mt-1 text-xs text-muted-foreground',
                    children: t('files.dropzone.subtitle'),
                  }),
                  _jsxs('p', {
                    className: 'mt-2 text-xs text-muted-foreground',
                    children: ['.docx, .pdf \u00B7 ', t('files.maxSize')],
                  }),
                ],
              }),
        ],
      }),
      selectedFile &&
        !uploadSuccess &&
        _jsxs('div', {
          className: 'flex items-center justify-between rounded-lg border p-3',
          children: [
            _jsxs('div', {
              className: 'flex items-center gap-3',
              children: [
                _jsx(FileText, { className: 'h-5 w-5 text-muted-foreground' }),
                _jsxs('div', {
                  children: [
                    _jsx('p', {
                      className: 'text-sm font-medium text-foreground',
                      children: selectedFile.name,
                    }),
                    _jsxs('p', {
                      className: 'text-xs text-muted-foreground',
                      children: [(selectedFile.size / 1024 / 1024).toFixed(1), ' MB'],
                    }),
                  ],
                }),
              ],
            }),
            _jsx(Button, {
              size: 'sm',
              onClick: handleUpload,
              disabled: isUploading,
              children: isUploading
                ? _jsxs(_Fragment, {
                    children: [
                      _jsx(Loader2, { className: 'mr-1 h-4 w-4 animate-spin' }),
                      t('files.uploading'),
                    ],
                  })
                : t('files.upload'),
            }),
          ],
        }),
      validationError &&
        _jsxs('div', {
          role: 'alert',
          className:
            'flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400',
          children: [
            _jsx(AlertCircle, { className: 'h-4 w-4 shrink-0' }),
            _jsx('span', { children: validationError }),
          ],
        }),
      uploadError &&
        _jsxs('div', {
          role: 'alert',
          className:
            'flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400',
          children: [
            _jsx(AlertCircle, { className: 'h-4 w-4 shrink-0' }),
            _jsx('span', { children: uploadError }),
            _jsx(Button, {
              variant: 'outline',
              size: 'sm',
              className: 'ml-auto',
              onClick: handleReset,
              children: t('files.retry'),
            }),
          ],
        }),
    ],
  });
}
