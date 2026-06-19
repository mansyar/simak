import { jsx as _jsx } from 'react/jsx-runtime';
import { ClipboardCheck } from 'lucide-react';
import { useI18n } from '../../routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
export function ReviewQueueEmptyState() {
  const { t } = useI18n();
  return _jsx(EmptyState, {
    icon: ClipboardCheck,
    title: t('instructorReviews.empty'),
    description: t('instructorReviews.emptyPrompt'),
  });
}
