import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RootErrorComponent } from '@/components/error-boundary';

const t = vi.fn((key: string) => `i18n:${key}`);

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn(() => ({ t })),
}));

describe('RootErrorComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the translated fallback heading and description', () => {
    render(<RootErrorComponent error={new Error('boom')} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('i18n:error.somethingWentWrong')).toBeInTheDocument();
    expect(screen.getByText('i18n:error.errorBoundaryDescription')).toBeInTheDocument();
  });

  it('renders a reload button and a home link', () => {
    render(<RootErrorComponent error={new Error('boom')} />);

    expect(screen.getByRole('button', { name: 'i18n:error.reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'i18n:common.goHome' })).toHaveAttribute('href', '/');
  });

  it('triggers window.location.reload when the reload button is clicked', () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    render(<RootErrorComponent error={new Error('boom')} />);

    fireEvent.click(screen.getByRole('button', { name: 'i18n:error.reload' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it('logs the error to the browser console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RootErrorComponent error={new Error('render failure')} />);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const entry = consoleError.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.code).toBe('INTERNAL');
    expect(entry.message).toBe('render failure');
  });
});
