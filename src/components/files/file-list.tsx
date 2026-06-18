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

interface Submission {
  id: number;
  version: number;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
}

interface FileListProps {
  submissions: Submission[];
  onDownload?: (submissionId: number) => Promise<string | void>;
}

function formatFileSize(
  bytes: number,
  _t: (key: string, params?: Record<string, string>) => string,
): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function FileList({ submissions, onDownload }: FileListProps) {
  const { t, locale } = useI18n();

  const handleDownload = useCallback(
    async (submissionId: number) => {
      if (onDownload) {
        await onDownload(submissionId);
      }
    },
    [onDownload],
  );

  if (submissions.length === 0) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={t('files.empty')}
        description={t('files.emptyPrompt')}
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('files.table.version')}</TableHead>
            <TableHead>{t('files.table.fileName')}</TableHead>
            <TableHead>{t('files.table.fileSize')}</TableHead>
            <TableHead>{t('files.table.uploadedAt')}</TableHead>
            <TableHead className="w-20">{t('files.table.action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="font-medium">
                {t('files.version', { version: String(submission.version) })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[200px]">{submission.fileName}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFileSize(submission.fileSize, t)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(submission.uploadedAt, locale)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(submission.id)}
                  title={t('files.download')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
