import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { useI18n } from '@/routes/__root';

interface RefreshButtonProps {
  isRefreshing: boolean;
  onClick: () => void;
}

export function RefreshButton({ isRefreshing, onClick }: RefreshButtonProps) {
  const { t } = useI18n();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={isRefreshing}
      aria-label={t('common.refresh')}
    >
      <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
    </Button>
  );
}
