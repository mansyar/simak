import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
export function ConsultationProgress({ counts }) {
  const { t } = useI18n();
  const totalRequired = counts.reduce((sum, c) => sum + c.minConsultations, 0);
  const totalVerified = counts.reduce((sum, c) => sum + c.verifiedCount, 0);
  if (totalRequired === 0) {
    return null;
  }
  return _jsxs('div', {
    className: 'space-y-3',
    children: [
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('consultations.consultationProgress') }),
          }),
          _jsx(CardContent, {
            children: _jsxs('div', {
              className: 'flex items-center gap-2',
              children: [
                _jsx('div', {
                  className: 'flex-1 h-2 bg-muted rounded-full overflow-hidden',
                  children: _jsx('div', {
                    className: 'h-full bg-primary rounded-full transition-all',
                    style: {
                      width: `${Math.min(100, (totalVerified / Math.max(1, totalRequired)) * 100)}%`,
                    },
                  }),
                }),
                _jsxs('span', {
                  className: 'text-xs font-medium text-muted-foreground whitespace-nowrap',
                  children: [totalVerified, '/', totalRequired, ' ', t('consultations.verified')],
                }),
              ],
            }),
          }),
        ],
      }),
      counts.map((cp) => {
        if (cp.minConsultations === 0) return null;
        const progress =
          cp.minConsultations > 0
            ? Math.min(100, (cp.verifiedCount / cp.minConsultations) * 100)
            : 0;
        const barColor =
          cp.verifiedCount >= cp.minConsultations
            ? 'bg-success'
            : cp.verifiedCount > 0
              ? 'bg-warning'
              : 'bg-muted-foreground/30';
        return _jsxs(
          'div',
          {
            className: 'space-y-1',
            children: [
              _jsxs('div', {
                className: 'flex items-center justify-between text-xs',
                children: [
                  _jsx('span', {
                    className: 'text-foreground font-medium',
                    children: cp.checkpointName,
                  }),
                  _jsxs('span', {
                    className: 'text-muted-foreground',
                    children: [
                      cp.verifiedCount,
                      '/',
                      cp.minConsultations,
                      ' ',
                      t('consultations.verified'),
                    ],
                  }),
                ],
              }),
              _jsx('div', {
                className: 'h-1.5 bg-muted rounded-full overflow-hidden',
                children: _jsx('div', {
                  className: `h-full rounded-full transition-all ${barColor}`,
                  style: { width: `${progress}%` },
                }),
              }),
            ],
          },
          cp.checkpointId,
        );
      }),
    ],
  });
}
