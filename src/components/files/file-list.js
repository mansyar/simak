import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useCallback } from 'react';
import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, FileText, FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
function formatFileSize(bytes, _t) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}
function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
export function FileList({ submissions, onDownload }) {
  const { t, locale } = useI18n();
  const handleDownload = useCallback(
    async (submissionId) => {
      if (onDownload) {
        await onDownload(submissionId);
      }
    },
    [onDownload],
  );
  if (submissions.length === 0) {
    return _jsx(EmptyState, {
      icon: FileQuestion,
      title: t('files.empty'),
      description: t('files.emptyPrompt'),
    });
  }
  return _jsx('div', {
    className: 'rounded-lg border',
    children: _jsxs(Table, {
      children: [
        _jsx(TableHeader, {
          children: _jsxs(TableRow, {
            children: [
              _jsx(TableHead, { children: t('files.table.version') }),
              _jsx(TableHead, { children: t('files.table.fileName') }),
              _jsx(TableHead, { children: t('files.table.fileSize') }),
              _jsx(TableHead, { children: t('files.table.uploadedAt') }),
              _jsx(TableHead, { className: 'w-20', children: t('files.table.action') }),
            ],
          }),
        }),
        _jsx(TableBody, {
          children: submissions.map((submission) =>
            _jsxs(
              TableRow,
              {
                children: [
                  _jsx(TableCell, {
                    className: 'font-medium',
                    children: t('files.version', { version: String(submission.version) }),
                  }),
                  _jsx(TableCell, {
                    children: _jsxs('div', {
                      className: 'flex items-center gap-2',
                      children: [
                        _jsx(FileText, { className: 'h-4 w-4 text-muted-foreground shrink-0' }),
                        _jsx('span', {
                          className: 'truncate max-w-[200px]',
                          children: submission.fileName,
                        }),
                      ],
                    }),
                  }),
                  _jsx(TableCell, {
                    className: 'text-muted-foreground',
                    children: formatFileSize(submission.fileSize, t),
                  }),
                  _jsx(TableCell, {
                    className: 'text-muted-foreground',
                    children: formatDate(submission.uploadedAt, locale),
                  }),
                  _jsx(TableCell, {
                    children: _jsx(Button, {
                      variant: 'ghost',
                      size: 'icon',
                      onClick: () => handleDownload(submission.id),
                      title: t('files.download'),
                      children: _jsx(Download, { className: 'h-4 w-4' }),
                    }),
                  }),
                ],
              },
              submission.id,
            ),
          ),
        }),
      ],
    }),
  });
}
