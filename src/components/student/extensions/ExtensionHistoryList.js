import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}
function getCategoryLabel(category) {
  const map = {
    personal: 'extensions.categoryPersonal',
    research: 'extensions.categoryResearch',
    health: 'extensions.categoryHealth',
    other: 'extensions.categoryOther',
  };
  return map[category] || category;
}
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
export function ExtensionHistoryList({ items }) {
  const { t } = useI18n();
  if (items.length === 0) {
    return _jsx('div', {
      className: 'rounded-lg border bg-card p-5 shadow-sm',
      children: _jsx('p', {
        className: 'text-sm text-muted-foreground',
        children: t('extensions.noHistory'),
      }),
    });
  }
  return _jsxs('div', {
    className: 'rounded-lg border bg-card p-5 shadow-sm',
    children: [
      _jsx('h3', {
        className: 'text-lg font-semibold text-foreground mb-4',
        children: t('extensions.historyTitle'),
      }),
      _jsx('div', {
        className: 'overflow-x-auto',
        children: _jsxs('table', {
          className: 'w-full text-sm',
          children: [
            _jsx('thead', {
              children: _jsxs('tr', {
                className: 'border-b border-border',
                children: [
                  _jsx('th', {
                    className: 'text-left pb-2 font-medium text-muted-foreground',
                    children: t('extensions.tableDate'),
                  }),
                  _jsx('th', {
                    className: 'text-left pb-2 font-medium text-muted-foreground',
                    children: t('extensions.tableCategory'),
                  }),
                  _jsx('th', {
                    className: 'text-left pb-2 font-medium text-muted-foreground',
                    children: t('extensions.tableDuration'),
                  }),
                  _jsx('th', {
                    className: 'text-left pb-2 font-medium text-muted-foreground',
                    children: t('extensions.tableStatus'),
                  }),
                  _jsx('th', {
                    className: 'text-left pb-2 font-medium text-muted-foreground',
                    children: t('extensions.tableResolution'),
                  }),
                ],
              }),
            }),
            _jsx('tbody', {
              children: items.map((item) =>
                _jsxs(
                  'tr',
                  {
                    className: 'border-b border-border last:border-b-0',
                    children: [
                      _jsx('td', {
                        className: 'py-3 pr-4 text-foreground',
                        children: formatDate(item.createdAt),
                      }),
                      _jsx('td', {
                        className: 'py-3 pr-4 text-foreground',
                        children: t(getCategoryLabel(item.category)),
                      }),
                      _jsxs('td', {
                        className: 'py-3 pr-4 text-foreground',
                        children: [item.extensionDays, ' days'],
                      }),
                      _jsx('td', {
                        className: 'py-3 pr-4',
                        children: _jsx(Badge, {
                          variant: getStatusBadgeVariant(item.status),
                          children: t(
                            `extensions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`,
                          ),
                        }),
                      }),
                      _jsx('td', {
                        className: 'py-3 text-foreground',
                        children: item.resolutionReason ?? '-',
                      }),
                    ],
                  },
                  item.id,
                ),
              ),
            }),
          ],
        }),
      }),
    ],
  });
}
