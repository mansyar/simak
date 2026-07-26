import { Button } from '@/components/ui/button';
import { useI18n } from '@/routes/__root';
import { useCsvDownload } from '@/hooks/use-csv-download';
import { exportGradebookCsv } from '@/server/analytics';
import { exportGradebookToExcel } from '@/lib/excel-export';

interface GradebookExportButtonsProps {
  assignmentId: number;
}

export function GradebookExportButtons({ assignmentId }: GradebookExportButtonsProps) {
  const { t } = useI18n();
  const { exportCsv, isExporting } = useCsvDownload();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        loading={isExporting}
        onClick={() =>
          exportCsv(
            () => exportGradebookCsv({ data: { assignmentId } }) as Promise<unknown>,
            'gradebook.csv',
          )
        }
      >
        {t('gradebook.exportCsv')}
      </Button>
      <Button variant="outline" onClick={() => exportGradebookToExcel(assignmentId)}>
        {t('gradebook.exportExcel')}
      </Button>
    </div>
  );
}
