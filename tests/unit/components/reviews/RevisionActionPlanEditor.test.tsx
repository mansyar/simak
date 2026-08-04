/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { RevisionActionPlanEditor } from '@/components/reviews/RevisionActionPlanEditor';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const rubric = {
  gradingType: 'numeric' as const,
  criteria: [
    { id: 7, title: 'Evidence', description: null, weight: 50, order: 0 },
    { id: 8, title: 'Structure', description: null, weight: 50, order: 1 },
  ],
  levels: [],
};

describe('RevisionActionPlanEditor', () => {
  it('adds and removes ordered action items', () => {
    const onChange = vi.fn();
    render(<RevisionActionPlanEditor items={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'instructorReviews.actionPlan.addItem' }));
    expect(onChange).toHaveBeenLastCalledWith([{ itemText: '' }]);

    render(
      <RevisionActionPlanEditor
        items={[{ itemText: 'First' }, { itemText: 'Second' }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'instructorReviews.actionPlan.removeItem' })[0],
    );
    expect(onChange).toHaveBeenLastCalledWith([{ itemText: 'Second' }]);
  });

  it('reorders items with keyboard-accessible controls', () => {
    const onChange = vi.fn();
    render(
      <RevisionActionPlanEditor
        items={[{ itemText: 'First' }, { itemText: 'Second' }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'instructorReviews.actionPlan.moveUp' })[1],
    );
    expect(onChange).toHaveBeenLastCalledWith([{ itemText: 'Second' }, { itemText: 'First' }]);
  });

  it('supports plain text validation, count limits, and rubric criterion selection', () => {
    const onChange = vi.fn();
    function Harness() {
      const [items, setItems] = useState([{ itemText: '' }]);
      return (
        <RevisionActionPlanEditor
          items={items}
          onChange={(nextItems) => {
            onChange(nextItems);
            setItems(nextItems);
          }}
          rubric={rubric}
        />
      );
    }
    render(<Harness />);

    const itemInput = screen.getByRole('textbox', {
      name: 'instructorReviews.actionPlan.itemLabel',
    });
    fireEvent.blur(itemInput);
    expect(screen.getByText('instructorReviews.actionPlan.itemRequired')).toBeDefined();

    fireEvent.change(itemInput, { target: { value: 'Fix the evidence' } });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'instructorReviews.actionPlan.criterionLabel' }),
      { target: { value: '7' } },
    );
    expect(onChange).toHaveBeenLastCalledWith([{ itemText: 'Fix the evidence', criterionId: 7 }]);
    expect(screen.getByText('Evidence')).toBeDefined();
  });

  it('disables adding an eleventh item', () => {
    const onChange = vi.fn();
    render(
      <RevisionActionPlanEditor
        items={Array.from({ length: 10 }, (_, index) => ({ itemText: `Item ${index + 1}` }))}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'instructorReviews.actionPlan.addItem' }),
    ).toBeDisabled();
  });
});
