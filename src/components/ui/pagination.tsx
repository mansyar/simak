import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/routes/__root';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  showCounter?: boolean;
  labelFormatter?: (current: number, totalPages: number) => string;
}

function getPageNumbers(current: number, total: number, maxVisible = 5): number[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = false,
  showCounter = false,
  labelFormatter,
}: PaginationProps) {
  const { t } = useI18n();

  const counterText = labelFormatter
    ? labelFormatter(currentPage, totalPages)
    : t('common.pageOf', { current: String(currentPage), total: String(totalPages) });

  const pageNumbers = showPageNumbers ? getPageNumbers(currentPage, totalPages) : [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-4">
      {showCounter ? <p className="text-sm text-muted-foreground">{counterText}</p> : <div />}
      <div className="flex flex-wrap items-center gap-1">
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
        {pageNumbers.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </Button>
        ))}
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
