/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

vi.mock('@/components/ui/sheet', () => {
  const SheetContent = ({ children, 'data-testid': testId }: any) => (
    <div data-slot="sheet-content" data-testid={testId}>
      {children}
    </div>
  );
  return {
    Sheet: ({ children, open }: any) => (open ? <div data-slot="sheet">{children}</div> : null),
    SheetContent,
    SheetHeader: ({ children }: any) => <div data-slot="sheet-header">{children}</div>,
    SheetFooter: ({ children }: any) => <div data-slot="sheet-footer">{children}</div>,
    SheetTitle: ({ children }: any) => <h2 data-slot="sheet-title">{children}</h2>,
    SheetDescription: ({ children }: any) => <p data-slot="sheet-description">{children}</p>,
    SheetClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

const TEST_URL = 'https://example.com/auth/setup-password?token=abc123';

describe('SetupLinkSheet', () => {
  let SetupLinkSheet: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/components/admin/users/SetupLinkSheet');
    SetupLinkSheet = mod.SetupLinkSheet;
  });

  it('should render the sheet with the setup link URL', () => {
    render(<SetupLinkSheet open={true} onOpenChange={vi.fn()} url={TEST_URL} />);
    expect(screen.getByDisplayValue(TEST_URL)).toBeDefined();
  });

  it('should render a copy button', () => {
    render(<SetupLinkSheet open={true} onOpenChange={vi.fn()} url={TEST_URL} />);
    expect(screen.getByRole('button', { name: /common.copy/i })).toBeDefined();
  });

  it('should copy the URL to clipboard and show feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SetupLinkSheet open={true} onOpenChange={vi.fn()} url={TEST_URL} />);
    fireEvent.click(screen.getByRole('button', { name: /common.copy/i }));
    expect(writeText).toHaveBeenCalledWith(TEST_URL);
    // After copy, should show linkCopied feedback (async state update)
    await waitFor(() => {
      expect(screen.getByText('adminUsers.linkCopied')).toBeDefined();
    });
  });

  it('should return null when closed', () => {
    const { container } = render(
      <SetupLinkSheet open={false} onOpenChange={vi.fn()} url={TEST_URL} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
