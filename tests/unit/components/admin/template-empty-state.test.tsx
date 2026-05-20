import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateEmptyState } from '@/components/admin/templates/TemplateEmptyState';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminTemplates.empty': 'No templates found',
        'adminTemplates.createPrompt': 'Create your first template',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick} data-testid="create-btn">
      {children}
    </button>
  ),
}));

describe('TemplateEmptyState', () => {
  it('should render empty state message', () => {
    render(<TemplateEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByText('No templates found')).toBeDefined();
  });

  it('should render create prompt message', () => {
    render(<TemplateEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByText('Create your first template')).toBeDefined();
  });

  it('should render create new button', () => {
    render(<TemplateEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByTestId('create-btn')).toBeDefined();
  });

  it('should call onCreateNew when button clicked', () => {
    const onCreateNew = vi.fn();
    render(<TemplateEmptyState onCreateNew={onCreateNew} />);
    screen.getByTestId('create-btn').click();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
