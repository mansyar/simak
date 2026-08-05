import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateRevisionActionItem: vi.fn(),
}));

vi.mock('@/server/revision-action-items', () => ({
  updateRevisionActionItem: mocks.updateRevisionActionItem,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, values?: { number?: string }) =>
      values?.number ? `${key}.${values.number}` : key,
  }),
}));

import { RevisionActionPlan } from '@/components/student/RevisionActionPlan';

const items = [
  {
    id: 2,
    itemText: 'Add supporting evidence',
    order: 1,
    criterionId: null,
    criterionTitle: null,
    addressedAt: new Date('2026-08-02'),
  },
  {
    id: 1,
    itemText: 'Rewrite the conclusion',
    order: 0,
    criterionId: 10,
    criterionTitle: 'Content Quality',
    addressedAt: null,
  },
];

describe('RevisionActionPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateRevisionActionItem.mockResolvedValue({ success: true });
  });

  it('renders current items in stable order with addressed state and criteria', () => {
    render(<RevisionActionPlan items={items} isCurrentPlan />);

    const renderedItems = screen.getAllByRole('listitem');
    expect(renderedItems[0]).toHaveTextContent('Rewrite the conclusion');
    expect(renderedItems[1]).toHaveTextContent('Add supporting evidence');
    expect(screen.getByText('Content Quality')).toBeInTheDocument();
    expect(screen.getByLabelText('studentRevisionActionPlan.item.1')).not.toBeChecked();
    expect(screen.getByLabelText('studentRevisionActionPlan.item.2')).toBeChecked();
  });

  it('optimistically toggles and reverses the owning student status', async () => {
    render(<RevisionActionPlan items={items} isCurrentPlan />);

    const firstCheckbox = screen.getByLabelText('studentRevisionActionPlan.item.1');
    fireEvent.click(firstCheckbox);

    expect(firstCheckbox).toBeChecked();
    expect(mocks.updateRevisionActionItem).toHaveBeenCalledWith({
      data: { itemId: 1, addressed: true },
    });

    await waitFor(() =>
      expect(screen.getAllByText('studentRevisionActionPlan.addressed')).toHaveLength(2),
    );

    fireEvent.click(firstCheckbox);
    expect(mocks.updateRevisionActionItem).toHaveBeenLastCalledWith({
      data: { itemId: 1, addressed: false },
    });
  });

  it('rolls back a failed toggle and announces the error', async () => {
    mocks.updateRevisionActionItem.mockResolvedValueOnce({
      error: { code: 'INTERNAL', message: 'Unable to update action item' },
    });
    render(<RevisionActionPlan items={items} isCurrentPlan />);

    const checkbox = screen.getByLabelText('studentRevisionActionPlan.item.1');
    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByRole('alert')).toHaveTextContent('error.internal');
  });

  it('shows historical statuses without mutation controls', () => {
    render(<RevisionActionPlan items={items} isCurrentPlan={false} />);

    expect(screen.getByText('studentRevisionActionPlan.historical')).toBeInTheDocument();
    expect(screen.getByText('studentRevisionActionPlan.addressed')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(mocks.updateRevisionActionItem).not.toHaveBeenCalled();
  });

  it('renders no plan when there are no action items', () => {
    const { container } = render(<RevisionActionPlan items={[]} isCurrentPlan />);

    expect(container.firstChild).toBeNull();
  });
});
