/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/admin/templates/DeleteTemplateDialog', () => ({
  DeleteTemplateDialog: () => <div data-testid="delete-dialog" />,
}));

vi.mock('lucide-react', () => ({
  Trash2: () => <div />,
}));

import { TemplateDangerZone } from '@/components/admin/templates/TemplateDangerZone';

describe('TemplateDangerZone heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render delete label as h2 (not h3) for proper heading order', () => {
    const { container } = render(<TemplateDangerZone assignmentCount={0} onDelete={vi.fn()} />);

    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe('adminTemplates.actions.delete');
    const h3 = container.querySelector('h3');
    expect(h3).toBeNull();
  });
});
