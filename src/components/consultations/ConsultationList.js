import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'verified':
      return 'success';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}
export function ConsultationList({ consultations }) {
  const { t } = useI18n();
  if (consultations.length === 0) {
    return _jsx('div', {
      className: 'text-center py-8 text-muted-foreground',
      children: _jsx('p', { children: t('consultations.noConsultations') }),
    });
  }
  return _jsx('div', {
    className: 'space-y-3',
    children: consultations.map((item) =>
      _jsxs(
        'div',
        {
          className: 'rounded-lg border bg-card p-4 shadow-sm space-y-2',
          children: [
            _jsxs('div', {
              className: 'flex items-center justify-between',
              children: [
                _jsx('span', {
                  className: 'font-medium text-sm text-foreground',
                  children: item.checkpointName,
                }),
                _jsx(Badge, {
                  variant: getStatusBadgeVariant(item.status),
                  children: t(`consultations.status.${item.status}`),
                }),
              ],
            }),
            _jsx('p', {
              className: 'text-sm text-muted-foreground line-clamp-2',
              children: item.notes ?? '-',
            }),
            _jsxs('div', {
              className: 'flex items-center justify-between text-xs text-muted-foreground',
              children: [
                _jsx('span', {
                  children:
                    item.sessionType === 'external' && item.externalConsultantName
                      ? `${t('consultations.external')}: ${item.externalConsultantName}`
                      : t('consultations.internal'),
                }),
                _jsx('span', { children: new Date(item.createdAt).toLocaleDateString() }),
              ],
            }),
          ],
        },
        item.id,
      ),
    ),
  });
}
