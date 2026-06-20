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
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={props['data-testid']} value={props.value} readOnly />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/alert-banner', () => ({
  AlertBanner: (props: any) => (
    <div data-testid="alert-banner" data-variant={props.variant}>
      {props.title}
    </div>
  ),
}));

vi.mock('@/components/ui/count-badge', () => ({
  CountBadge: ({ count, ...props }: any) => (
    <span data-testid="count-badge" {...props}>
      {count}
    </span>
  ),
}));

const template = {
  name: 'Thesis Template',
  type: 'Thesis',
  createdAt: new Date('2026-01-15'),
  createdBy: 'user-1',
  createdByName: 'Dr. Smith',
  assignmentCount: 3,
};

describe('TemplateMetadata', () => {
  it('should render the name input with current value', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={template}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.getByTestId('template-name')).toHaveValue('Thesis Template');
  });

  it('should render the type input with current value', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={template}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.getByTestId('template-type')).toHaveValue('Thesis');
  });

  it('should render created by info', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={template}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('should show in-use banner when assignmentCount > 0', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={template}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.getByTestId('alert-banner')).toHaveAttribute('data-variant', 'warning');
  });

  it('should not show in-use banner when assignmentCount is 0', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={{ ...template, assignmentCount: 0 }}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('should use CountBadge to show assignment count in the in-use banner', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={template}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.getByTestId('count-badge')).toHaveTextContent('3');
  });

  it('should not render CountBadge when assignmentCount is 0', async () => {
    const { TemplateMetadata } = await import('@/components/admin/templates/TemplateMetadata');
    render(
      <TemplateMetadata
        template={{ ...template, assignmentCount: 0 }}
        name="Thesis Template"
        onNameChange={() => {}}
        type="Thesis"
        onTypeChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('count-badge')).not.toBeInTheDocument();
  });
});
