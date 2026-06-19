import { PageHeader } from '@/components/ui/page-header';
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
    <PageHeader
      title={studentName}
      subtitle={`${assignmentTitle} — ${checkpointName}`}
      back={{
        to: '/instructor/reviews',
        label: t('common.back'),
        search: { page: 1, limit: 20 },
      }}
    />
  );
}
