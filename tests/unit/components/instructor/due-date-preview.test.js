import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DueDatePreview } from '@/components/instructor/assignments/DueDatePreview';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'instructorAssignments.wizard.stepDueDates': 'Due Dates',
        'instructorAssignments.wizard.dueDatesPrompt': 'Review and adjust due dates',
        'instructorAssignments.wizard.daysLabel': 'days',
        'instructorAssignments.wizard.dueDateFor': 'Due date for',
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
  }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    type,
    className,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
  }) =>
    _jsx('input', {
      type: type,
      value: value,
      onChange: onChange,
      className: className,
      'data-testid': dataTestId,
      'aria-label': ariaLabel,
    }),
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => _jsx('div', { className: className, children: children }),
}));
describe('DueDatePreview', () => {
  const defaultCheckpoints = [
    { name: 'Proposal', order: 1, estimatedDuration: 14 },
    { name: 'Drafting', order: 2, estimatedDuration: 30 },
    { name: 'Defense', order: 3, estimatedDuration: 7 },
  ];
  const baseDate = new Date('2026-06-01T00:00:00Z');
  it('should render all checkpoint cards with names and durations', () => {
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: [],
        onOverride: vi.fn(),
        baseDate: baseDate,
      }),
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Drafting')).toBeDefined();
    expect(screen.getByText('Defense')).toBeDefined();
    expect(screen.getByText('Due Dates')).toBeDefined();
    expect(screen.getByText('Review and adjust due dates')).toBeDefined();
  });
  it('should calculate cumulative due dates correctly', () => {
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: [],
        onOverride: vi.fn(),
        baseDate: baseDate,
      }),
    );
    // CP1: June 1 + 14 days = June 15
    const cp1Input = screen.getByTestId('due-date-input-1');
    expect(cp1Input.value).toBe('2026-06-15');
    // CP2: June 1 + 14 + 30 = July 15
    const cp2Input = screen.getByTestId('due-date-input-2');
    expect(cp2Input.value).toBe('2026-07-15');
    // CP3: June 1 + 14 + 30 + 7 = July 22
    const cp3Input = screen.getByTestId('due-date-input-3');
    expect(cp3Input.value).toBe('2026-07-22');
  });
  it('should handle zero estimated duration correctly (same-day due)', () => {
    const checkpointsWithZero = [
      { name: 'Quick Task', order: 1, estimatedDuration: 0 },
      { name: 'Follow-up', order: 2, estimatedDuration: 5 },
    ];
    render(
      _jsx(DueDatePreview, {
        checkpoints: checkpointsWithZero,
        overrides: [],
        onOverride: vi.fn(),
        baseDate: baseDate,
      }),
    );
    // CP1: June 1 + 0 days = June 1
    const cp1Input = screen.getByTestId('due-date-input-1');
    expect(cp1Input.value).toBe('2026-06-01');
    // CP2: June 1 + 0 + 5 = June 6
    const cp2Input = screen.getByTestId('due-date-input-2');
    expect(cp2Input.value).toBe('2026-06-06');
  });
  it('should default to current date when no baseDate is provided', () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    render(
      _jsx(DueDatePreview, { checkpoints: defaultCheckpoints, overrides: [], onOverride: vi.fn() }),
    );
    const cp1Input = screen.getByTestId('due-date-input-1');
    // Should use today + 14 days
    const expected = new Date(today);
    expected.setDate(expected.getDate() + 14);
    expect(cp1Input.value).toBe(expected.toISOString().slice(0, 10));
  });
  it('should show override visual highlight when a checkpoint date is overridden', () => {
    const overrides = [{ checkpointOrder: 2, dueDate: '2026-08-01T12:00:00.000Z' }];
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: overrides,
        onOverride: vi.fn(),
        baseDate: baseDate,
      }),
    );
    // Check overridden checkpoint shows effective date
    const cp2Input = screen.getByTestId('due-date-input-2');
    expect(cp2Input.value).toBe('2026-08-01');
  });
  it('should call onOverride with new override when user changes a date', () => {
    const onOverride = vi.fn();
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: [],
        onOverride: onOverride,
        baseDate: baseDate,
      }),
    );
    const cp1Input = screen.getByTestId('due-date-input-1');
    fireEvent.change(cp1Input, { target: { value: '2026-06-20' } });
    expect(onOverride).toHaveBeenCalledTimes(1);
    const calledWith = onOverride.mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].checkpointOrder).toBe(1);
    expect(calledWith[0].dueDate).toContain('2026-06-20');
  });
  it('should remove override when user clears a date', () => {
    const overrides = [
      { checkpointOrder: 1, dueDate: '2026-06-20T12:00:00.000Z' },
      { checkpointOrder: 2, dueDate: '2026-07-15T12:00:00.000Z' },
    ];
    const onOverride = vi.fn();
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: overrides,
        onOverride: onOverride,
        baseDate: baseDate,
      }),
    );
    const cp1Input = screen.getByTestId('due-date-input-1');
    fireEvent.change(cp1Input, { target: { value: '' } });
    expect(onOverride).toHaveBeenCalledTimes(1);
    const calledWith = onOverride.mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].checkpointOrder).toBe(2);
  });
  it('should update overrides when user changes an already-overridden date', () => {
    const overrides = [{ checkpointOrder: 2, dueDate: '2026-08-01T12:00:00.000Z' }];
    const onOverride = vi.fn();
    render(
      _jsx(DueDatePreview, {
        checkpoints: defaultCheckpoints,
        overrides: overrides,
        onOverride: onOverride,
        baseDate: baseDate,
      }),
    );
    const cp2Input = screen.getByTestId('due-date-input-2');
    fireEvent.change(cp2Input, { target: { value: '2026-08-15' } });
    expect(onOverride).toHaveBeenCalledTimes(1);
    const calledWith = onOverride.mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].checkpointOrder).toBe(2);
    expect(calledWith[0].dueDate).toContain('2026-08-15');
  });
  it('should render empty state when no checkpoints are provided', () => {
    render(
      _jsx(DueDatePreview, {
        checkpoints: [],
        overrides: [],
        onOverride: vi.fn(),
        baseDate: baseDate,
      }),
    );
    // Should still show the header text
    expect(screen.getByText('Due Dates')).toBeDefined();
    expect(screen.getByText('Review and adjust due dates')).toBeDefined();
    // No checkpoint cards
    expect(screen.queryByTestId('due-date-input-1')).toBeNull();
  });
});
