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
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('renders a reload button and a dashboard link', () => {
    render(<RootErrorComponent error={new Error('boom')} />);

    expect(screen.getByRole('button', { name: 'i18n:error.reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'i18n:common.goToDashboard' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('triggers window.location.reload when the reload button is clicked', () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    render(<RootErrorComponent error={new Error('boom')} />);

    fireEvent.click(screen.getByRole('button', { name: 'i18n:error.reload' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it('logs the error via console.error', () => {
    render(<RootErrorComponent error={new Error('render failure')} />);

    expect(console.error).toHaveBeenCalled();
    const calls = vi.mocked(console.error).mock.calls;
    const merged = calls.map((call) => call.join(' ')).join('\n');
    expect(merged).toContain('INTERNAL');
    expect(merged).toContain('render failure');
  });
});
