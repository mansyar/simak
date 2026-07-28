/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn) => fn),
}));

vi.mock('@/server/templates', () => ({
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  listTemplateAssignments: vi.fn(),
}));

vi.mock('@/server/rubrics', () => ({
  saveRubric: vi.fn(),
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/components/ui/back-link', () => ({
  BackLink: () => <div data-testid="back-link" />,
}));

vi.mock('@/components/ui/alert-banner', () => ({
  AlertBanner: () => <div data-testid="alert-banner" />,
}));

vi.mock('@/components/admin/templates/TemplateMetadata', () => ({
  TemplateMetadata: () => <div data-testid="template-metadata" />,
}));

vi.mock('@/components/admin/templates/TemplateCheckpointSection', () => ({
  TemplateCheckpointSection: () => <div data-testid="template-checkpoint-section" />,
}));

vi.mock('@/components/admin/templates/TemplateLinkedAssignments', () => ({
  TemplateLinkedAssignments: () => <div data-testid="template-linked-assignments" />,
}));

vi.mock('@/components/admin/templates/TemplateDangerZone', () => ({
  TemplateDangerZone: () => <div data-testid="template-danger-zone" />,
}));

import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';

describe('TemplateDetailPage heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render an h1 with the template name for proper heading order', () => {
    const template = {
      id: 1,
      name: 'Thesis Template',
      type: 'thesis',
      createdBy: null,
      createdByName: null,
      createdAt: null,
      updatedAt: null,
      assignmentCount: 0,
      checkpoints: [],
    };

    const { container } = render(
      <TemplateDetailPage template={template} assignments={[]} assignmentsTotal={0} />,
    );

    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('Thesis Template');
  });
});
