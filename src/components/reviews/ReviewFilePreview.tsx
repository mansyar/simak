import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '../../routes/__root';

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
            <span>{new Date(uploadedAt).toLocaleDateString()}</span>
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

        {/* Download button */}
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
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
