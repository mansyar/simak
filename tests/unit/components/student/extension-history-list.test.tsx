import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockT, mockFormatDate } = vi.hoisted(() => {
  const translations: Record<string, string> = {
    'extensions.historyTitle': 'Extension History',
    'extensions.noHistory': 'No extension requests yet',
    'extensions.tableDate': 'Date',
    'extensions.tableCategory': 'Category',
    'extensions.tableDuration': 'Duration',
    'extensions.tableStatus': 'Status',
    'extensions.tableResolution': 'Resolution',
    'extensions.statusPending': 'Pending',
    'extensions.statusApproved': 'Approved',
    'extensions.statusRejected': 'Rejected',
    'extensions.categoryPersonal': 'Personal',
    'extensions.categoryResearch': 'Research',
    'extensions.categoryHealth': 'Health',
    'extensions.categoryOther': 'Other',
    'extensions.daysCount': '{count} days',
  };
  return {
    mockT: vi.fn((key: string, params?: Record<string, string>) => {
      let result = translations[key] || key;
      if (params) {
        for (const [param, value] of Object.entries(params)) {
          result = result.replace(`{${param}}`, value);
        }
      }
      return result;
    }),
    mockFormatDate: vi.fn(
      (date: string, locale: string, style: string) => `formatted-${date}-${locale}-${style}`,
    ),
  };
});

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: mockT, locale: 'en' }),
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: mockFormatDate,
}));

import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';

describe('ExtensionHistoryList', () => {
  const mockItems = [
    {
      id: 1,
      category: 'personal',
      extensionDays: 3,
      status: 'pending' as const,
      reason: 'Family event',
      createdAt: new Date('2026-05-28T10:00:00Z'),
      resolvedAt: null,
      resolutionReason: null,
      checkpointName: null,
    },
    {
      id: 2,
      category: 'health',
      extensionDays: 5,
      status: 'approved' as const,
      reason: 'Medical leave',
      createdAt: new Date('2026-05-25T08:00:00Z'),
      resolvedAt: new Date('2026-05-26T14:00:00Z'),
      resolutionReason: 'Approved due to valid medical certificate',
      checkpointName: 'Proposal',
    },
    {
      id: 3,
      category: 'research',
      extensionDays: 7,
      status: 'rejected' as const,
      reason: 'Need more data',
      createdAt: new Date('2026-05-20T12:00:00Z'),
      resolvedAt: new Date('2026-05-22T09:00:00Z'),
      resolutionReason: 'Insufficient justification for 7-day extension',
      checkpointName: 'Chapter 1',
    },
  ];

  it('should render the history title', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByRole('heading', { name: 'Extension History' })).toBeDefined();
  });

  it('should render table headers', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Date')).toBeDefined();
    expect(screen.getByText('Category')).toBeDefined();
    expect(screen.getByText('Duration')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Resolution')).toBeDefined();
  });

  it('should expose table context and column scopes', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByRole('table').querySelector('caption')?.textContent).toBe(
      'Extension History',
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(
      screen.getAllByRole('columnheader').every((header) => header.getAttribute('scope') === 'col'),
    ).toBe(true);
  });

  it('should render pending status badge', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('should render approved status badge', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('should render rejected status badge', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Rejected')).toBeDefined();
  });

  it('should render category labels', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Health')).toBeDefined();
    expect(screen.getByText('Research')).toBeDefined();
  });

  it('should render duration values', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('3 days')).toBeDefined();
    expect(screen.getByText('5 days')).toBeDefined();
    expect(screen.getByText('7 days')).toBeDefined();
  });

  it('should render resolution reason for resolved items', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('Approved due to valid medical certificate')).toBeDefined();
    expect(screen.getByText('Insufficient justification for 7-day extension')).toBeDefined();
  });

  it('should show dash for pending resolution', () => {
    render(<ExtensionHistoryList items={mockItems} />);
    expect(screen.getByText('-')).toBeDefined();
  });

  it('should render empty state when no items', () => {
    render(<ExtensionHistoryList items={[]} />);
    expect(screen.getByText('No extension requests yet')).toBeDefined();
  });

  describe('i18n days count (UX-18)', () => {
    beforeEach(() => {
      mockT.mockClear();
    });

    it('calls t() with extensions.daysCount and count param for each item', () => {
      render(<ExtensionHistoryList items={mockItems} />);
      expect(mockT).toHaveBeenCalledWith('extensions.daysCount', { count: '3' });
      expect(mockT).toHaveBeenCalledWith('extensions.daysCount', { count: '5' });
      expect(mockT).toHaveBeenCalledWith('extensions.daysCount', { count: '7' });
    });

    it('does not use hardcoded "days" suffix', () => {
      render(<ExtensionHistoryList items={mockItems} />);
      const daysCountCalls = mockT.mock.calls.filter((call) => call[0] === 'extensions.daysCount');
      expect(daysCountCalls).toHaveLength(3);
    });
  });

  describe('shared formatDate (UX-19)', () => {
    beforeEach(() => {
      mockFormatDate.mockClear();
    });

    it('uses shared formatDate from @/lib/format-date with locale and short style', () => {
      render(<ExtensionHistoryList items={mockItems} />);
      expect(mockFormatDate).toHaveBeenCalledWith(mockItems[0].createdAt, 'en', 'short', 'UTC');
      expect(mockFormatDate).toHaveBeenCalledWith(mockItems[1].createdAt, 'en', 'short', 'UTC');
      expect(mockFormatDate).toHaveBeenCalledWith(mockItems[2].createdAt, 'en', 'short', 'UTC');
    });

    it('calls shared formatDate once per item', () => {
      render(<ExtensionHistoryList items={mockItems} />);
      expect(mockFormatDate).toHaveBeenCalledTimes(mockItems.length);
    });
  });
});
