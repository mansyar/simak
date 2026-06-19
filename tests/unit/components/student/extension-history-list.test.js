import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
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
      };
      return translations[key] || key;
    },
  }),
}));
import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';
describe('ExtensionHistoryList', () => {
  const mockItems = [
    {
      id: 1,
      category: 'personal',
      extensionDays: 3,
      status: 'pending',
      reason: 'Family event',
      createdAt: new Date('2026-05-28T10:00:00Z').toISOString(),
      resolvedAt: null,
      resolutionReason: null,
      checkpointName: null,
    },
    {
      id: 2,
      category: 'health',
      extensionDays: 5,
      status: 'approved',
      reason: 'Medical leave',
      createdAt: new Date('2026-05-25T08:00:00Z').toISOString(),
      resolvedAt: new Date('2026-05-26T14:00:00Z').toISOString(),
      resolutionReason: 'Approved due to valid medical certificate',
      checkpointName: 'Proposal',
    },
    {
      id: 3,
      category: 'research',
      extensionDays: 7,
      status: 'rejected',
      reason: 'Need more data',
      createdAt: new Date('2026-05-20T12:00:00Z').toISOString(),
      resolvedAt: new Date('2026-05-22T09:00:00Z').toISOString(),
      resolutionReason: 'Insufficient justification for 7-day extension',
      checkpointName: 'Chapter 1',
    },
  ];
  it('should render the history title', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Extension History')).toBeDefined();
  });
  it('should render table headers', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Date')).toBeDefined();
    expect(screen.getByText('Category')).toBeDefined();
    expect(screen.getByText('Duration')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Resolution')).toBeDefined();
  });
  it('should render pending status badge', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Pending')).toBeDefined();
  });
  it('should render approved status badge', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Approved')).toBeDefined();
  });
  it('should render rejected status badge', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Rejected')).toBeDefined();
  });
  it('should render category labels', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Health')).toBeDefined();
    expect(screen.getByText('Research')).toBeDefined();
  });
  it('should render duration values', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('3 days')).toBeDefined();
    expect(screen.getByText('5 days')).toBeDefined();
    expect(screen.getByText('7 days')).toBeDefined();
  });
  it('should render resolution reason for resolved items', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('Approved due to valid medical certificate')).toBeDefined();
    expect(screen.getByText('Insufficient justification for 7-day extension')).toBeDefined();
  });
  it('should show dash for pending resolution', () => {
    render(_jsx(ExtensionHistoryList, { items: mockItems }));
    expect(screen.getByText('-')).toBeDefined();
  });
  it('should render empty state when no items', () => {
    render(_jsx(ExtensionHistoryList, { items: [] }));
    expect(screen.getByText('No extension requests yet')).toBeDefined();
  });
});
