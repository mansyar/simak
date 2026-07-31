/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock __root useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('Sonner Toaster — Region Containment', () => {
  it('passes the translated label to the Toaster region', async () => {
    const { Toaster } = await import('@/components/ui/sonner');
    const { container } = render(<Toaster />);
    const section = container.querySelector('section[aria-label]');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-label')).toContain('notifications.toasterLabel');
  });
});
