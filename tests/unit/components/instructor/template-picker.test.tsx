import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplatePicker } from '@/components/instructor/assignments/TemplatePicker';
import * as templatesApi from '@/server/templates';

vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'instructorAssignments.wizard.stepTemplate': 'Select Template',
        'instructorAssignments.wizard.selectTemplatePrompt':
          'Choose an assignment template to define milestones',
        'instructorAssignments.wizard.checkpointsPreview': 'Milestones Preview',
      };
      let text = translations[key] || key;
      if (params) {
        Object.keys(params).forEach((p) => {
          text = text.replace(`{${p}}`, params[p]);
        });
      }
      return text;
    },
  }),
}));

describe('TemplatePicker', () => {
  const mockTemplates = [
    {
      id: 1,
      name: 'Thesis Template',
      type: 'Thesis',
      checkpoints: ['Proposal', 'Drafting', 'Defense'],
    },
    {
      id: 2,
      name: 'Internship Report',
      type: 'Internship',
      checkpoints: ['Initial Plan', 'Weekly Report', 'Final Submission'],
    },
  ];

  const onSelectTemplate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templatesApi.listTemplates).mockResolvedValue({
      templates: mockTemplates,
      total: 2,
    } as any);
  });

  it('should render loading skeleton initially and load templates', async () => {
    render(<TemplatePicker selectedTemplateId={null} onSelectTemplate={onSelectTemplate} />);

    // Should show the title
    expect(screen.getByText('Select Template')).toBeDefined();

    // Wait for the mock api call and state updates
    await waitFor(() => {
      expect(screen.getByText('Thesis Template')).toBeDefined();
      expect(screen.getByText('Internship Report')).toBeDefined();
    });
  });

  it('should filter templates based on search query', async () => {
    render(<TemplatePicker selectedTemplateId={null} onSelectTemplate={onSelectTemplate} />);

    await waitFor(() => {
      expect(screen.getByText('Thesis Template')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Search templates by name or type...');
    fireEvent.change(searchInput, { target: { value: 'Intern' } });

    expect(screen.queryByText('Thesis Template')).toBeNull();
    expect(screen.getByText('Internship Report')).toBeDefined();
  });

  it('should trigger onSelectTemplate when clicking a template card', async () => {
    render(<TemplatePicker selectedTemplateId={null} onSelectTemplate={onSelectTemplate} />);

    await waitFor(() => {
      expect(screen.getByText('Thesis Template')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Thesis Template'));
    expect(onSelectTemplate).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should show the milestones roadmap preview when template is selected', async () => {
    render(<TemplatePicker selectedTemplateId={1} onSelectTemplate={onSelectTemplate} />);

    await waitFor(() => {
      expect(screen.getAllByText('Thesis Template')[0]).toBeDefined();
      // Milestone sequence preview should be shown
      expect(screen.getByText('Proposal')).toBeDefined();
      expect(screen.getByText('Drafting')).toBeDefined();
      expect(screen.getByText('Defense')).toBeDefined();
    });
  });
});
