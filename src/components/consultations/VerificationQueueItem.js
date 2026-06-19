import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
export function VerificationQueueItem({ consultation, onClick }) {
  const { t } = useI18n();
  const notesPreview = consultation.notes
    ? consultation.notes.length > 80
      ? consultation.notes.slice(0, 80) + '...'
      : consultation.notes
    : '-';
  return _jsxs('button', {
    type: 'button',
    onClick: () => onClick(consultation.id),
    className:
      'w-full text-left rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors space-y-2',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsx('span', {
            className: 'font-medium text-sm text-foreground',
            children: consultation.studentName,
          }),
          _jsx('span', {
            className: 'text-xs text-muted-foreground',
            children: new Date(consultation.createdAt).toLocaleDateString(),
          }),
        ],
      }),
      _jsxs('div', {
        className: 'text-xs text-muted-foreground',
        children: [
          consultation.checkpointName,
          ' · ',
          consultation.sessionType === 'external' && consultation.externalConsultantName
            ? t('consultations.sessionExternal', { name: consultation.externalConsultantName })
            : t('consultations.sessionInternal'),
        ],
      }),
      _jsx('p', {
        className: 'text-sm text-muted-foreground line-clamp-1',
        children: notesPreview,
      }),
    ],
  });
}
