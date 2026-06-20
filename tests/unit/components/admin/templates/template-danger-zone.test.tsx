/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button data-variant={props.variant} data-testid="btn" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/admin/templates/DeleteTemplateDialog', () => ({
  DeleteTemplateDialog: (props: any) => <div data-testid="delete-dialog" data-open={props.open} />,
}));

describe('TemplateDangerZone', () => {
  it('should render delete button with destructive variant', async () => {
    const { TemplateDangerZone } = await import('@/components/admin/templates/TemplateDangerZone');
    render(<TemplateDangerZone assignmentCount={0} onDelete={() => {}} />);
    const buttons = screen.getAllByText('adminTemplates.actions.delete');
    const deleteBtn = buttons.find((el) => el.closest('button'));
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn!.closest('button')).toHaveAttribute('data-variant', 'destructive');
  });

  it('should render delete confirmation description', async () => {
    const { TemplateDangerZone } = await import('@/components/admin/templates/TemplateDangerZone');
    render(<TemplateDangerZone assignmentCount={0} onDelete={() => {}} />);
    expect(screen.getByText('adminTemplates.deleteConfirm')).toBeInTheDocument();
  });

  it('should render DeleteTemplateDialog', async () => {
    const { TemplateDangerZone } = await import('@/components/admin/templates/TemplateDangerZone');
    render(<TemplateDangerZone assignmentCount={2} onDelete={() => {}} />);
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });
});
