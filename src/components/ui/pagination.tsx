import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/routes/__root';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between py-4">
      <p className="text-sm text-muted-foreground">
        {t('common.pageOf', { current: String(currentPage), total: String(totalPages) })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label={t('common.previousPage')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('common.back')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label={t('common.nextPage')}
        >
          {t('common.next')}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
