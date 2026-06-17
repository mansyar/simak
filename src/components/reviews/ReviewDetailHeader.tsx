import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '../../routes/__root';

interface ReviewDetailHeaderProps {
  studentName: string;
  assignmentTitle: string;
  checkpointName: string;
}

export function ReviewDetailHeader({
  studentName,
  assignmentTitle,
  checkpointName,
}: ReviewDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <Link to="/instructor/reviews" search={{ page: 1, limit: 20 }} className="inline-flex">
        <Button variant="ghost" size="sm" type="button">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('common.back')}
        </Button>
      </Link>

      {/* Header info */}
      <div>
        <h1 className="font-display text-3xl text-foreground">{studentName}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span>{assignmentTitle}</span>
          <span>—</span>
          <span className="font-medium text-foreground">{checkpointName}</span>
        </div>
      </div>
    </div>
  );
}
