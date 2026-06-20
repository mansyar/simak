import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('@/components/ui/back-link', () => ({
  BackLink: ({ to, label, search }: any) => (
    <a href={to as string} data-testid="back-link" data-search={JSON.stringify(search)}>
      {label}
    </a>
  ),
}));

describe('TemplateNotFound', () => {
  it('should render the not-found message', async () => {
    const { TemplateNotFound } = await import('@/components/admin/templates/TemplateNotFound');
    render(<TemplateNotFound />);

    expect(screen.getByText('error.notFound')).toBeInTheDocument();
    expect(screen.getByText('error.templateNotFound')).toBeInTheDocument();
  });

  it('should render BackLink primitive pointing to /admin/templates with search params', async () => {
    const { TemplateNotFound } = await import('@/components/admin/templates/TemplateNotFound');
    render(<TemplateNotFound />);

    const backLink = screen.getByTestId('back-link');
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute('href')).toBe('/admin/templates');
    expect(backLink.textContent).toBe('adminTemplates.detail.back');
    expect(backLink.getAttribute('data-search')).toBe(
      JSON.stringify({ page: 1, limit: 20, search: '', type: '' }),
    );
  });

  it('should use EmptyState primitive with h3 title and border-dashed container', async () => {
    const { TemplateNotFound } = await import('@/components/admin/templates/TemplateNotFound');
    const { container } = render(<TemplateNotFound />);

    // EmptyState uses h3, not h2
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('error.notFound');

    // EmptyState container has border-dashed
    const dashedContainer = container.querySelector('.border-dashed');
    expect(dashedContainer).toBeTruthy();
  });
});
