import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../../routes/__root';
import { CheckpointCard } from './CheckpointCard';
export function CheckpointTimeline({ checkpoints, assignmentId }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-4',
    children: [
      _jsx('h3', {
        className: 'font-display text-2xl text-foreground',
        children: t('studentAssignments.timeline'),
      }),
      _jsx('div', {
        className: 'space-y-3',
        children: checkpoints.map((checkpoint, index) =>
          _jsxs(
            'div',
            {
              className: 'relative pl-6',
              children: [
                index < checkpoints.length - 1 &&
                  _jsx('div', { className: 'absolute left-[7px] top-4 bottom-0 w-0.5 bg-border' }),
                _jsx('div', {
                  className:
                    'absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background',
                }),
                _jsx(CheckpointCard, { checkpoint: checkpoint, assignmentId: assignmentId }),
              ],
            },
            checkpoint.id,
          ),
        ),
      }),
    ],
  });
}
