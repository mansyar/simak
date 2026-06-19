import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsultationList } from '@/components/consultations/ConsultationList';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'consultations.noConsultations': 'No consultations logged yet.',
        'consultations.status.pending': 'Pending',
        'consultations.status.verified': 'Verified',
        'consultations.status.rejected': 'Rejected',
        'consultations.internal': 'Internal',
        'consultations.external': 'External',
      };
      return translations[key] || key;
    },
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
    createdAt: '2026-05-20T10:00:00Z',
  };
  it('should render empty state when no consultations', () => {
    render(_jsx(ConsultationList, { consultations: [] }));
    expect(screen.getByText('No consultations logged yet.')).toBeDefined();
  });
  it('should render consultation checkpoint name', () => {
    render(_jsx(ConsultationList, { consultations: [baseConsultation] }));
    expect(screen.getByText('Proposal')).toBeDefined();
  });
  it('should render consultation notes', () => {
    render(_jsx(ConsultationList, { consultations: [baseConsultation] }));
    expect(screen.getByText('Student discussed topic selection.')).toBeDefined();
  });
  it('should render pending status badge with warning variant', () => {
    render(_jsx(ConsultationList, { consultations: [baseConsultation] }));
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-warning');
    expect(badge.className).toContain('text-warning');
  });
  it('should render verified status badge with success variant', () => {
    render(
      _jsx(ConsultationList, { consultations: [{ ...baseConsultation, status: 'verified' }] }),
    );
    const badge = screen.getByText('Verified');
    expect(badge.className).toContain('bg-success');
    expect(badge.className).toContain('text-success');
  });
  it('should render rejected status badge with destructive variant', () => {
    render(
      _jsx(ConsultationList, { consultations: [{ ...baseConsultation, status: 'rejected' }] }),
    );
    const badge = screen.getByText('Rejected');
    expect(badge.className).toContain('bg-destructive');
    expect(badge.className).toContain('text-destructive');
  });
  it('should render internal session type', () => {
    render(_jsx(ConsultationList, { consultations: [baseConsultation] }));
    expect(screen.getByText('Internal')).toBeDefined();
  });
  it('should render external session type with consultant name', () => {
    render(
      _jsx(ConsultationList, {
        consultations: [
          {
            ...baseConsultation,
            sessionType: 'external',
            externalConsultantName: 'Dr. Smith',
          },
        ],
      }),
    );
    expect(screen.getByText(/Dr. Smith/)).toBeDefined();
  });
  it('should render date', () => {
    render(_jsx(ConsultationList, { consultations: [baseConsultation] }));
    expect(screen.getByText(/20\/05\/2026/)).toBeDefined();
  });
  it('should render dash for null notes', () => {
    render(_jsx(ConsultationList, { consultations: [{ ...baseConsultation, notes: null }] }));
    expect(screen.getByText('-')).toBeDefined();
  });
  it('should render multiple consultations', () => {
    const items = [
      baseConsultation,
      { ...baseConsultation, id: 2, checkpointName: 'Chapter 1', notes: 'Reviewed draft.' },
    ];
    render(_jsx(ConsultationList, { consultations: items }));
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
    expect(screen.getByText('Reviewed draft.')).toBeDefined();
  });
});
