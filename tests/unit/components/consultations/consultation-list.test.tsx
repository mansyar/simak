import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsultationList } from '@/components/consultations/ConsultationList';

const { mockFormatDate } = vi.hoisted(() => ({
  mockFormatDate: vi.fn(
    (date: string, locale: string, style: string) => `formatted-${date}-${locale}-${style}`,
  ),
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: mockFormatDate,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'consultations.noConsultations': 'No consultations logged yet.',
        'consultations.status.pending': 'Pending',
        'consultations.status.verified': 'Verified',
        'consultations.status.rejected': 'Rejected',
        'consultations.internal': 'Internal',
        'consultations.external': 'External',
      };
      return translations[key] || key;
    },
    locale: 'en' as const,
  }),
}));

describe('ConsultationList', () => {
  const baseConsultation = {
    id: 1,
    checkpointName: 'Proposal',
    sessionType: 'internal',
    externalConsultantName: null,
    notes: 'Student discussed topic selection.',
    status: 'pending',
    createdAt: new Date('2026-05-20T10:00:00Z'),
  };

  it('should render EmptyState component when no consultations', () => {
    render(<ConsultationList consultations={[]} />);
    expect(screen.getByText('No consultations logged yet.')).toBeDefined();
    // Verify EmptyState component is used (has dashed border container)
  });

  it('should render EmptyState with dashed border when no consultations', () => {
    const { container } = render(<ConsultationList consultations={[]} />);
    const emptyState = container.querySelector('.border-dashed');
    expect(emptyState).not.toBeNull();
  });

  it('should render consultation checkpoint name', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    expect(screen.getByText('Proposal')).toBeDefined();
  });

  it('should render consultation notes', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    expect(screen.getByText('Student discussed topic selection.')).toBeDefined();
  });

  it('should render pending status badge with warning variant', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-warning');
    expect(badge.className).toContain('text-warning');
  });

  it('should render verified status badge with success variant', () => {
    render(<ConsultationList consultations={[{ ...baseConsultation, status: 'verified' }]} />);
    const badge = screen.getByText('Verified');
    expect(badge.className).toContain('bg-success');
    expect(badge.className).toContain('text-success');
  });

  it('should render rejected status badge with destructive variant', () => {
    render(<ConsultationList consultations={[{ ...baseConsultation, status: 'rejected' }]} />);
    const badge = screen.getByText('Rejected');
    expect(badge.className).toContain('bg-destructive');
    expect(badge.className).toContain('text-destructive');
  });

  it('should render internal session type', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    expect(screen.getByText('Internal')).toBeDefined();
  });

  it('should render external session type with consultant name', () => {
    render(
      <ConsultationList
        consultations={[
          {
            ...baseConsultation,
            sessionType: 'external',
            externalConsultantName: 'Dr. Smith',
          },
        ]}
      />,
    );
    expect(screen.getByText(/Dr. Smith/)).toBeDefined();
  });

  it('should render date', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    expect(mockFormatDate).toHaveBeenCalledWith(baseConsultation.createdAt, 'en', 'short', 'UTC');
  });

  it('should render dash for null notes', () => {
    render(<ConsultationList consultations={[{ ...baseConsultation, notes: null }]} />);
    expect(screen.getByText('-')).toBeDefined();
  });

  it('should render multiple consultations', () => {
    const items = [
      baseConsultation,
      { ...baseConsultation, id: 2, checkpointName: 'Chapter 1', notes: 'Reviewed draft.' },
    ];
    render(<ConsultationList consultations={items} />);
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
    expect(screen.getByText('Reviewed draft.')).toBeDefined();
  });
});

describe('ConsultationList - shared formatDate (UX-20)', () => {
  const baseConsultation = {
    id: 1,
    checkpointName: 'Proposal',
    sessionType: 'internal',
    externalConsultantName: null,
    notes: 'Student discussed topic selection.',
    status: 'pending',
    createdAt: new Date('2026-05-20T10:00:00Z'),
  };

  beforeEach(() => {
    mockFormatDate.mockClear();
  });

  it('uses formatDate from @/lib/format-date with locale and short style', () => {
    render(<ConsultationList consultations={[baseConsultation]} />);
    expect(mockFormatDate).toHaveBeenCalledWith(baseConsultation.createdAt, 'en', 'short', 'UTC');
  });

  it('calls formatDate once per consultation item', () => {
    const items = [
      baseConsultation,
      { ...baseConsultation, id: 2, checkpointName: 'Chapter 1' },
      { ...baseConsultation, id: 3, checkpointName: 'Chapter 2' },
    ];
    render(<ConsultationList consultations={items} />);
    expect(mockFormatDate).toHaveBeenCalledTimes(items.length);
  });
});
