import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'consultations.consultationProgress': 'Consultation Progress',
        'consultations.verified': 'verified',
        'consultations.noConsultationsRequired': 'No consultations required for this assignment',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ConsultationProgress', () => {
  it('should render Card with message when totalRequired is 0', () => {
    const { container } = render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 0, minConsultations: 0 },
        ]}
      />,
    );
    expect(container.innerHTML).not.toBe('');
    expect(screen.getByText('No consultations required for this assignment')).toBeDefined();
  });

  it('should render consultation progress title when totalRequired is 0', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 0, minConsultations: 0 },
        ]}
      />,
    );
    expect(screen.getByText('Consultation Progress')).toBeDefined();
  });

  it('should render summary title', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ]}
      />,
    );
    expect(screen.getByText('Consultation Progress')).toBeDefined();
  });

  it('should render summary progress in the summary section', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ]}
      />,
    );
    const spans = screen.getAllByText('verified', { exact: false });
    const summarySpan = spans.find((s) => s.className.includes('whitespace-nowrap'));
    expect(summarySpan).toBeDefined();
    expect(summarySpan?.textContent).toContain('1');
    expect(summarySpan?.textContent).toContain('2');
  });

  it('should render per-checkpoint progress', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ]}
      />,
    );
    expect(screen.getByText('Proposal')).toBeDefined();
  });

  it('should skip checkpoint with minConsultations 0', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 0, minConsultations: 0 },
        ]}
      />,
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.queryByText('Chapter 1')).toBeNull();
  });

  it('should render green bar when verified count meets minimum', () => {
    const { container } = render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
        ]}
      />,
    );
    const greenEl = container.querySelector('.bg-green-500');
    expect(greenEl).toBeDefined();
  });

  it('should render yellow bar when verified count is partial', () => {
    const { container } = render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 3 },
        ]}
      />,
    );
    const yellowEl = container.querySelector('.bg-yellow-500');
    expect(yellowEl).toBeDefined();
  });

  it('should render gray bar when verified count is 0', () => {
    const { container } = render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 0, minConsultations: 2 },
        ]}
      />,
    );
    const grayEl = container.querySelector('.bg-gray-300');
    expect(grayEl).toBeDefined();
  });

  it('should render multiple checkpoints', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 1, minConsultations: 3 },
        ]}
      />,
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });

  it('should calculate total summary correctly across checkpoints', () => {
    render(
      <ConsultationProgress
        counts={[
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 1, minConsultations: 3 },
        ]}
      />,
    );
    const spans = screen.getAllByText('verified', { exact: false });
    const summarySpan = spans.find((s) => s.className.includes('whitespace-nowrap'));
    expect(summarySpan?.textContent).toContain('3');
    expect(summarySpan?.textContent).toContain('5');
  });
});

describe('ConsultationProgress - progressbar ARIA attributes (UX-21)', () => {
  const mockCounts = [
    { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 3 },
    { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 1, minConsultations: 2 },
  ];

  it('summary progress bar has role="progressbar"', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const summaryBar = container.querySelector('.flex-1.h-2');
    expect(summaryBar?.getAttribute('role')).toBe('progressbar');
  });

  it('summary progress bar has aria-valuenow equal to totalVerified', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const summaryBar = container.querySelector('.flex-1.h-2');
    // totalVerified = 2 + 1 = 3
    expect(summaryBar?.getAttribute('aria-valuenow')).toBe('3');
  });

  it('summary progress bar has aria-valuemin=0 and aria-valuemax equal to totalRequired', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const summaryBar = container.querySelector('.flex-1.h-2');
    // totalRequired = 3 + 2 = 5
    expect(summaryBar?.getAttribute('aria-valuemin')).toBe('0');
    expect(summaryBar?.getAttribute('aria-valuemax')).toBe('5');
  });

  it('summary progress bar has aria-label from t("consultations.consultationProgress")', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const summaryBar = container.querySelector('.flex-1.h-2');
    expect(summaryBar?.getAttribute('aria-label')).toBe('Consultation Progress');
  });

  it('per-checkpoint progress bars have role="progressbar"', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    // Per-checkpoint bars use h-1.5 class (not h-2 which is the summary bar)
    const checkpointBars = container.querySelectorAll('.h-1\\.5.bg-muted');
    expect(checkpointBars.length).toBe(2);
    checkpointBars.forEach((bar) => {
      expect(bar.getAttribute('role')).toBe('progressbar');
    });
  });

  it('per-checkpoint progress bars have aria-valuenow, aria-valuemin, aria-valuemax', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const checkpointBars = container.querySelectorAll('.h-1\\.5.bg-muted');
    // Checkpoint 1: verifiedCount=2, minConsultations=3
    expect(checkpointBars[0].getAttribute('aria-valuenow')).toBe('2');
    expect(checkpointBars[0].getAttribute('aria-valuemin')).toBe('0');
    expect(checkpointBars[0].getAttribute('aria-valuemax')).toBe('3');
    // Checkpoint 2: verifiedCount=1, minConsultations=2
    expect(checkpointBars[1].getAttribute('aria-valuenow')).toBe('1');
    expect(checkpointBars[1].getAttribute('aria-valuemin')).toBe('0');
    expect(checkpointBars[1].getAttribute('aria-valuemax')).toBe('2');
  });

  it('per-checkpoint progress bars have aria-label with checkpoint name', () => {
    const { container } = render(<ConsultationProgress counts={mockCounts} />);
    const checkpointBars = container.querySelectorAll('.h-1\\.5.bg-muted');
    expect(checkpointBars[0].getAttribute('aria-label')).toBe('Proposal');
    expect(checkpointBars[1].getAttribute('aria-label')).toBe('Chapter 1');
  });
});
