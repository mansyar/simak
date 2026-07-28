/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock __root useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock sonner to capture props passed to the underlying Toaster
vi.mock('sonner', () => ({
  Toaster: (props: any) => <section data-testid="sonner-toaster" {...props} />,
}));

describe('Sonner Toaster — Region Containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes aria-label to the Toaster section', async () => {
    const { Toaster } = await import('@/components/ui/sonner');
    const { container } = render(<Toaster />);
    const section = container.querySelector('[data-testid="sonner-toaster"]');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-label')).not.toBeNull();
  });
});
