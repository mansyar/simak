import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsultationProgress } from '@/components/consultations/ConsultationProgress';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'consultations.consultationProgress': 'Consultation Progress',
        'consultations.verified': 'verified',
      };
      return translations[key] || key;
    },
  }),
}));
describe('ConsultationProgress', () => {
  it('should return null when totalRequired is 0', () => {
    const { container } = render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 0, minConsultations: 0 },
        ],
      }),
    );
    expect(container.innerHTML).toBe('');
  });
  it('should render summary title', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ],
      }),
    );
    expect(screen.getByText('Consultation Progress')).toBeDefined();
  });
  it('should render summary progress in the summary section', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ],
      }),
    );
    const spans = screen.getAllByText('verified', { exact: false });
    const summarySpan = spans.find((s) => s.className.includes('whitespace-nowrap'));
    expect(summarySpan).toBeDefined();
    expect(summarySpan?.textContent).toContain('1');
    expect(summarySpan?.textContent).toContain('2');
  });
  it('should render per-checkpoint progress', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
        ],
      }),
    );
    expect(screen.getByText('Proposal')).toBeDefined();
  });
  it('should skip checkpoint with minConsultations 0', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 0, minConsultations: 0 },
        ],
      }),
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.queryByText('Chapter 1')).toBeNull();
  });
  it('should render green bar when verified count meets minimum', () => {
    const { container } = render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
        ],
      }),
    );
    const greenEl = container.querySelector('.bg-green-500');
    expect(greenEl).toBeDefined();
  });
  it('should render yellow bar when verified count is partial', () => {
    const { container } = render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 1, minConsultations: 3 },
        ],
      }),
    );
    const yellowEl = container.querySelector('.bg-yellow-500');
    expect(yellowEl).toBeDefined();
  });
  it('should render gray bar when verified count is 0', () => {
    const { container } = render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 0, minConsultations: 2 },
        ],
      }),
    );
    const grayEl = container.querySelector('.bg-gray-300');
    expect(grayEl).toBeDefined();
  });
  it('should render multiple checkpoints', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 1, minConsultations: 3 },
        ],
      }),
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });
  it('should calculate total summary correctly across checkpoints', () => {
    render(
      _jsx(ConsultationProgress, {
        counts: [
          { checkpointId: 1, checkpointName: 'Proposal', verifiedCount: 2, minConsultations: 2 },
          { checkpointId: 2, checkpointName: 'Chapter 1', verifiedCount: 1, minConsultations: 3 },
        ],
      }),
    );
    const spans = screen.getAllByText('verified', { exact: false });
    const summarySpan = spans.find((s) => s.className.includes('whitespace-nowrap'));
    expect(summarySpan?.textContent).toContain('3');
    expect(summarySpan?.textContent).toContain('5');
  });
});
