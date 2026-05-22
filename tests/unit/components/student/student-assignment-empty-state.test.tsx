import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { StudentAssignmentEmptyState } from '@/components/student/assignments/StudentAssignmentEmptyState';

describe('StudentAssignmentEmptyState', () => {
  it('should render the empty message', () => {
    render(<StudentAssignmentEmptyState />);
    expect(screen.getByText('studentAssignments.empty')).toBeDefined();
  });

  it('should render a prompt message', () => {
    render(<StudentAssignmentEmptyState />);
    expect(screen.getByText('studentAssignments.emptyPrompt')).toBeDefined();
  });
});
