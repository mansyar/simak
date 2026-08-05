import { useState, useEffect } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateShort } from '@/lib/format';
import { useI18n } from '../../routes/__root';

const MAX_DOCX_SIZE = 10 * 1024 * 1024; // 10MB

interface ReviewFilePreviewProps {
  fileName: string;
  fileSize: number;
  version: number;
  uploadedAt: Date;
  downloadUrl: string;
}

export function ReviewFilePreview({
  fileName,
  fileSize,
  version,
  uploadedAt,
  downloadUrl,
}: ReviewFilePreviewProps) {
  const { t } = useI18n();
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const isDocx = fileName.toLowerCase().endsWith('.docx');
  const isDocxTooLarge = isDocx && fileSize > MAX_DOCX_SIZE;

  const [docxState, setDocxState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [docxHtml, setDocxHtml] = useState('');

  useEffect(() => {
    if (!isDocx || isDocxTooLarge) return;

    let cancelled = false;
    setDocxState('loading');

    (async () => {
      try {
        const response = await fetch(downloadUrl);
        const arrayBuffer = await response.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) {
          setDocxHtml(result.value);
          setDocxState('success');
        }
      } catch {
        if (!cancelled) {
          setDocxState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDocx, isDocxTooLarge, downloadUrl]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t('instructorReviews.submittedFile')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="font-medium text-foreground">{fileName}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span>
              {t('instructorReviews.versionLabel')}: {version}
            </span>
            <span>{formatFileSize(fileSize)}</span>
            <span>{formatDateShort(uploadedAt)}</span>
          </div>
        </div>

        {/* PDF inline preview */}
        {isPdf && (
          <div className="rounded-md border bg-muted/30 overflow-hidden">
            <embed
              src={downloadUrl}
              type="application/pdf"
              className="w-full h-96"
              title={fileName}
            />
          </div>
        )}

        {/* DOCX loading state */}
        {isDocx && !isDocxTooLarge && docxState === 'loading' && (
          <div className="rounded-md border bg-muted/30 p-6 flex flex-col items-center gap-2 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('files.convertingDocx')}</p>
          </div>
        )}

        {/* DOCX success — sandboxed iframe */}
        {isDocx && !isDocxTooLarge && docxState === 'success' && (
          <div className="rounded-md border bg-muted/30 overflow-hidden">
            <iframe srcDoc={docxHtml} sandbox="" className="w-full h-96" title={fileName} />
          </div>
        )}

        {/* DOCX error state */}
        {isDocx && !isDocxTooLarge && docxState === 'error' && (
          <div
            className="rounded-md border bg-muted/30 p-6 flex flex-col items-center gap-2 text-center"
            role="alert"
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('files.previewNotAvailable')}</p>
          </div>
        )}

        {/* DOCX too large for preview */}
        {isDocx && isDocxTooLarge && (
          <div className="rounded-md border bg-muted/30 p-6 flex flex-col items-center gap-2 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('files.tooLargeForPreview')}</p>
          </div>
        )}

        {/* Preview not available for non-PDF/non-DOCX files (FR-5) */}
        {!isPdf && !isDocx && (
          <div className="rounded-md border bg-muted/30 p-6 flex flex-col items-center gap-2 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('files.previewNotAvailable')}</p>
          </div>
        )}

        {/* Download button */}
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="h-4 w-4" />
          {isPdf ? t('instructorReviews.downloadPdf') : t('instructorReviews.downloadFile')}
        </a>
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
