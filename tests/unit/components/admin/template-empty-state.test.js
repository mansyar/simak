import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateEmptyState } from '@/components/admin/templates/TemplateEmptyState';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'adminTemplates.empty': 'No templates found',
        'adminTemplates.createPrompt': 'Create your first template',
      };
      return translations[key] || key;
    },
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }) =>
    _jsx('button', { onClick: onClick, 'data-testid': 'create-btn', children: children }),
}));
describe('TemplateEmptyState', () => {
  it('should render empty state message', () => {
    render(_jsx(TemplateEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByText('No templates found')).toBeDefined();
  });
  it('should render create prompt message', () => {
    render(_jsx(TemplateEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByText('Create your first template')).toBeDefined();
  });
  it('should render create new button', () => {
    render(_jsx(TemplateEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByTestId('create-btn')).toBeDefined();
  });
  it('should call onCreateNew when button clicked', () => {
    const onCreateNew = vi.fn();
    render(_jsx(TemplateEmptyState, { onCreateNew: onCreateNew }));
    screen.getByTestId('create-btn').click();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
