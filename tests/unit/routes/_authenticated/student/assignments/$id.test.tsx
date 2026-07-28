/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { mockAssignmentData } = vi.hoisted(() => ({
  mockAssignmentData: {
    id: 1,
    title: 'Thesis Assignment',
    description: 'A description',
    finalDeadline: '2026-06-01T00:00:00.000Z',
    effectiveDeadline: null,
    instructorName: 'Dr. Smith',
    templateName: 'Thesis Template',
    templateType: 'thesis',
    progressPercent: 50,
    maxExtensionDays: 7,
    maxTotalExtensions: 3,
    checkpoints: [],
  } as any,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mockAssignmentData,
    useParams: () => ({ submissionId: '1' }),
  })),
  useMatchRoute: vi.fn().mockReturnValue(() => false),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
  }),
}));

vi.mock('@/server/assignments', () => ({
  getStudentAssignmentDetail: vi.fn(),
}));

vi.mock('@/server/consultations', () => ({
  listConsultations: vi.fn().mockResolvedValue({ consultations: [], total: 0 }),
  listVerifiedCounts: vi.fn().mockResolvedValue({ counts: [] }),
}));

vi.mock('@/server/extensions', () => ({
  listMyExtensionRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/components/gradebook/StudentFinalGradeCard', () => ({
  StudentFinalGradeCard: () => <div data-testid="final-grade-card" />,
}));

vi.mock('@/components/student/assignments/AssignmentDetailHeader', () => ({
  AssignmentDetailHeader: ({ detail }: any) => <h1 data-testid="detail-header">{detail.title}</h1>,
}));

vi.mock('@/components/student/assignments/CheckpointTimeline', () => ({
  CheckpointTimeline: () => <div data-testid="checkpoint-timeline" />,
}));

vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: () => <div data-testid="loading-skeleton" />,
}));

vi.mock('@/components/consultations/ConsultationForm', () => ({
  ConsultationForm: () => <div data-testid="consultation-form" />,
}));

vi.mock('@/components/consultations/ConsultationList', () => ({
  ConsultationList: () => <div data-testid="consultation-list" />,
}));

vi.mock('@/components/consultations/ConsultationProgress', () => ({
  ConsultationProgress: () => <div data-testid="consultation-progress" />,
}));

vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

vi.mock('@/components/student/extensions/ExtensionRequestForm', () => ({
  ExtensionRequestForm: () => <div data-testid="extension-request-form" />,
}));

vi.mock('@/components/student/extensions/ExtensionHistoryList', () => ({
  ExtensionHistoryList: () => <div data-testid="extension-history-list" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div />,
}));

describe('Student Assignment Detail heading order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render consultation section titles as h2 (not h3) for proper heading order', async () => {
    const mod = await import('@/routes/_authenticated/student/assignments/$id');
    const Component = (mod.Route as any).component;
    const { container } = render(<Component />);

    // Click on the consultations tab
    const tabButtons = container.querySelectorAll('button[type="button"]');
    const consultationsTab = Array.from(tabButtons).find(
      (btn) => btn.textContent === 'consultations.title',
    );
    expect(consultationsTab).toBeDefined();
    fireEvent.click(consultationsTab!);

    // Wait for loading to finish and h2 to appear
    await waitFor(() => {
      const h2s = container.querySelectorAll('h2');
      expect(h2s.length).toBeGreaterThanOrEqual(1);
    });

    // Verify no h3 exists (the old heading level)
    const h3s = container.querySelectorAll('h3');
    expect(h3s.length).toBe(0);
  });

  it('should render extension section title as h2 (not h3) for proper heading order', async () => {
    const mod = await import('@/routes/_authenticated/student/assignments/$id');
    const Component = (mod.Route as any).component;
    const { container } = render(<Component />);

    // Click on the extensions tab
    const tabButtons = container.querySelectorAll('button[type="button"]');
    const extensionsTab = Array.from(tabButtons).find(
      (btn) => btn.textContent === 'extensions.requestTitle',
    );
    expect(extensionsTab).toBeDefined();
    fireEvent.click(extensionsTab!);

    // Wait for loading to finish and h2 to appear
    await waitFor(() => {
      const h2s = container.querySelectorAll('h2');
      expect(h2s.length).toBeGreaterThanOrEqual(1);
    });

    // Verify no h3 exists (the old heading level)
    const h3s = container.querySelectorAll('h3');
    expect(h3s.length).toBe(0);
  });
});
