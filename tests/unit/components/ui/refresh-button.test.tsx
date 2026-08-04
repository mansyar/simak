/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RefreshButton } from '@/components/ui/refresh-button';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.refresh': 'Refresh',
      };
      return translations[key] ?? key;
    },
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('RefreshButton', () => {
  it('should render with aria-label', () => {
    render(<RefreshButton isRefreshing={false} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /refresh/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });

  it('should be disabled when isRefreshing is true', () => {
    render(<RefreshButton isRefreshing={true} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /refresh/i });
    expect(button).toHaveProperty('disabled', true);
  });

  it('should fire onClick when clicked', () => {
    const onClick = vi.fn();
    render(<RefreshButton isRefreshing={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<RefreshButton isRefreshing={true} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
