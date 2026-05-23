import { FileText, Download, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">
        {t('instructorReviews.submittedFile')}
      </h3>

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
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(downloadUrl, '_blank')}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        {isPdf ? t('instructorReviews.downloadPdf') : t('instructorReviews.downloadFile')}
      </Button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
