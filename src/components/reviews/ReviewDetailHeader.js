import { jsx as _jsx } from 'react/jsx-runtime';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '../../routes/__root';
export function ReviewDetailHeader({ studentName, assignmentTitle, checkpointName }) {
  const { t } = useI18n();
  return _jsx(PageHeader, {
    title: studentName,
    subtitle: `${assignmentTitle} — ${checkpointName}`,
    back: {
      to: '/instructor/reviews',
      label: t('common.back'),
      search: { page: 1, limit: 20 },
    },
  });
}
