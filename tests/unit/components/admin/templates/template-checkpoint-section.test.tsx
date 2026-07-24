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

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...(actual as any),
    Link: vi.fn().mockImplementation(({ children, ...props }: any) => (
      <a data-mock-link="" href={props.to || '#'} {...props}>
        {children}
      </a>
    )),
  };
});

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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button data-variant={props.variant} {...props}>
      {children}
    </button>
  ),
}));

let capturedProps: any = null;

vi.mock('@/components/admin/templates/CheckpointListEditor', () => ({
  CheckpointListEditor: (props: any) => {
    capturedProps = props;
    return <div data-testid="checkpoint-list-editor" />;
  },
}));

const checkpoints = [
  { name: 'Chapter 1', minConsultations: 2, estimatedDuration: 7 },
  { name: 'Chapter 2', minConsultations: 3, estimatedDuration: 14 },
];

describe('TemplateCheckpointSection', () => {
  it('should render the CheckpointListEditor', async () => {
    const { TemplateCheckpointSection } =
      await import('@/components/admin/templates/TemplateCheckpointSection');
    render(
      <TemplateCheckpointSection
        checkpoints={checkpoints}
        onAdd={() => {}}
        onRemove={() => {}}
        onChange={() => {}}
        onMinConsultationsChange={() => {}}
        onEstimatedDurationChange={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onSave={() => {}}
        isSaving={false}
      />,
    );
    expect(screen.getByTestId('checkpoint-list-editor')).toBeInTheDocument();
  });

  it('should render save and cancel buttons', async () => {
    const { TemplateCheckpointSection } =
      await import('@/components/admin/templates/TemplateCheckpointSection');
    render(
      <TemplateCheckpointSection
        checkpoints={checkpoints}
        onAdd={() => {}}
        onRemove={() => {}}
        onChange={() => {}}
        onMinConsultationsChange={() => {}}
        onEstimatedDurationChange={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onSave={() => {}}
        isSaving={false}
      />,
    );
    expect(screen.getByText('common.save')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('should show saving text when isSaving', async () => {
    const { TemplateCheckpointSection } =
      await import('@/components/admin/templates/TemplateCheckpointSection');
    render(
      <TemplateCheckpointSection
        checkpoints={checkpoints}
        onAdd={() => {}}
        onRemove={() => {}}
        onChange={() => {}}
        onMinConsultationsChange={() => {}}
        onEstimatedDurationChange={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onSave={() => {}}
        isSaving={true}
      />,
    );
    expect(screen.getByText('common.saving')).toBeInTheDocument();
  });

  it('should pass onGradingTypeChange through to CheckpointListEditor', async () => {
    const { TemplateCheckpointSection } =
      await import('@/components/admin/templates/TemplateCheckpointSection');
    const onGradingTypeChange = vi.fn();
    render(
      <TemplateCheckpointSection
        checkpoints={checkpoints}
        onAdd={() => {}}
        onRemove={() => {}}
        onChange={() => {}}
        onMinConsultationsChange={() => {}}
        onEstimatedDurationChange={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onSave={() => {}}
        isSaving={false}
        onGradingTypeChange={onGradingTypeChange}
      />,
    );
    expect(capturedProps.onGradingTypeChange).toBe(onGradingTypeChange);
  });
});
