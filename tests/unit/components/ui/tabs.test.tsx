import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock useI18n for CountBadge dependency
vi.mock('../../../src/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

import { Tabs } from '@/components/ui/tabs';

describe('Tabs', () => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'students', label: 'Students' },
    { id: 'settings', label: 'Settings' },
  ];

  it('should render all tab labels', () => {
    render(<Tabs tabs={tabs} activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Students')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('should set active state on the current tab', () => {
    render(<Tabs tabs={tabs} activeTab="students" onTabChange={vi.fn()} />);
    const activeButton = screen.getByText('Students');
    expect(activeButton.getAttribute('data-state')).toBe('active');
  });

  it('should set inactive state on non-active tabs', () => {
    render(<Tabs tabs={tabs} activeTab="students" onTabChange={vi.fn()} />);
    const inactiveButton = screen.getByText('Overview');
    expect(inactiveButton.getAttribute('data-state')).toBe('inactive');
  });

  it('should call onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="overview" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('should render count badge when count is provided', () => {
    const tabsWithCount = [
      { id: 'overview', label: 'Overview' },
      { id: 'students', label: 'Students', count: 5 },
    ];
    render(<Tabs tabs={tabsWithCount} activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('should hide count badge when count is zero and hideWhenZero is true', () => {
    const tabsWithCount = [{ id: 'overview', label: 'Overview', count: 0 }];
    render(<Tabs tabs={tabsWithCount} activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Tabs tabs={tabs} activeTab="overview" onTabChange={vi.fn()} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
