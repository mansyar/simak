import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '../../routes/__root';
export function ReviewFilePreview({ fileName, fileSize, version, uploadedAt, downloadUrl }) {
  const { t } = useI18n();
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  return _jsxs(Card, {
    className: 'shadow-sm',
    children: [
      _jsx(CardHeader, {
        children: _jsx(CardTitle, {
          className: 'text-sm',
          children: t('instructorReviews.submittedFile'),
        }),
      }),
      _jsxs(CardContent, {
        className: 'space-y-3',
        children: [
          _jsxs('div', {
            className: 'space-y-2 text-sm text-muted-foreground',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  _jsx(FileText, { className: 'h-4 w-4' }),
                  _jsx('span', { className: 'font-medium text-foreground', children: fileName }),
                ],
              }),
              _jsxs('div', {
                className: 'flex items-center gap-4 text-xs',
                children: [
                  _jsxs('span', { children: [t('instructorReviews.versionLabel'), ': ', version] }),
                  _jsx('span', { children: formatFileSize(fileSize) }),
                  _jsx('span', { children: new Date(uploadedAt).toLocaleDateString() }),
                ],
              }),
            ],
          }),
          isPdf &&
            _jsx('div', {
              className: 'rounded-md border bg-muted/30 overflow-hidden',
              children: _jsx('embed', {
                src: downloadUrl,
                type: 'application/pdf',
                className: 'w-full h-96',
                title: fileName,
              }),
            }),
          _jsxs('a', {
            href: downloadUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
              'inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
            children: [
              _jsx(Download, { className: 'h-4 w-4' }),
              isPdf ? t('instructorReviews.downloadPdf') : t('instructorReviews.downloadFile'),
            ],
          }),
        ],
      }),
    ],
  });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
