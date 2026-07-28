/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: () => 'Jan 1, 2026',
}));

import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';

describe('ExtensionHistoryList heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render history title as h2 (not h3) for proper heading order', () => {
    const items = [
      {
        id: 1,
        category: 'personal',
        extensionDays: 3,
        status: 'pending' as const,
        reason: 'Need more time',
        createdAt: new Date(),
        resolvedAt: null,
        resolutionReason: null,
        checkpointName: 'Chapter 1',
      },
    ];

    const { container } = render(<ExtensionHistoryList items={items} />);

    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe('extensions.historyTitle');
    const h3 = container.querySelector('h3');
    expect(h3).toBeNull();
  });
});
