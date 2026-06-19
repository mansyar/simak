import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerificationQueueItem } from '@/components/consultations/VerificationQueueItem';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'consultations.sessionInternal': 'Internal',
        'consultations.sessionExternal': 'External: {name}',
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
  }),
}));
describe('VerificationQueueItem', () => {
  const onClick = vi.fn();
  const baseConsultation = {
    id: 42,
    studentName: 'Alice Johnson',
    checkpointName: 'Proposal',
    sessionType: 'internal',
    externalConsultantName: null,
    notes: 'Student discussed topic selection methodology.',
    createdAt: '2026-05-20T10:00:00Z',
  };
  it('should render student name', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    expect(screen.getByText('Alice Johnson')).toBeDefined();
  });
  it('should render date', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    expect(screen.getByText(/20\/05\/2026/)).toBeDefined();
  });
  it('should render checkpoint name', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    expect(screen.getByText(/Proposal/)).toBeDefined();
  });
  it('should render internal session type', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    expect(screen.getByText(/Internal/)).toBeDefined();
  });
  it('should render external session type with consultant name', () => {
    render(
      _jsx(VerificationQueueItem, {
        consultation: {
          ...baseConsultation,
          sessionType: 'external',
          externalConsultantName: 'Dr. Smith',
        },
        onClick: onClick,
      }),
    );
    expect(screen.getByText(/External: Dr. Smith/)).toBeDefined();
  });
  it('should render notes preview', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    expect(screen.getByText('Student discussed topic selection methodology.')).toBeDefined();
  });
  it('should render dash when notes is null', () => {
    render(
      _jsx(VerificationQueueItem, {
        consultation: { ...baseConsultation, notes: null },
        onClick: onClick,
      }),
    );
    expect(screen.getByText('-')).toBeDefined();
  });
  it('should truncate long notes to 80 characters', () => {
    const longNotes = 'A'.repeat(100);
    render(
      _jsx(VerificationQueueItem, {
        consultation: { ...baseConsultation, notes: longNotes },
        onClick: onClick,
      }),
    );
    const expected = 'A'.repeat(80) + '...';
    expect(screen.getByText(expected)).toBeDefined();
  });
  it('should call onClick with consultation id when clicked', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledWith(42);
  });
  it('should render as a button', () => {
    render(_jsx(VerificationQueueItem, { consultation: baseConsultation, onClick: onClick }));
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
    expect(btn.tagName).toBe('BUTTON');
  });
});
