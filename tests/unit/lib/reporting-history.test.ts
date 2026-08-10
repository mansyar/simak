import { describe, expect, it } from 'vitest';
import {
  hasActiveReportJobs,
  isReportDownloadable,
  isReportExpired,
  toReportHistoryJob,
  type ReportHistoryJob,
} from '@/lib/reporting-history';

function job(overrides: Partial<ReportHistoryJob> = {}): ReportHistoryJob {
  return {
    id: 7,
    reportType: 'analytics_summary',
    locale: 'en',
    state: 'completed',
    createdAt: new Date('2026-08-10T10:00:00Z'),
    completedAt: new Date('2026-08-10T10:05:00Z'),
    failedAt: null,
    expiresAt: new Date('2026-09-09T10:00:00Z'),
    ...overrides,
  };
}

describe('toReportHistoryJob', () => {
  it('normalizes a raw server job into the client-safe shape', () => {
    const raw = {
      id: 7,
      reportType: 'analytics_summary' as const,
      locale: 'en' as const,
      state: 'completed' as const,
      createdAt: '2026-08-10T10:00:00Z',
      completedAt: '2026-08-10T10:05:00Z',
      failedAt: null,
      expiresAt: '2026-09-09T10:00:00Z',
      artifactKey: 'reports/secret.pdf',
      failureCode: 'generation_failed',
      failureMessage: 'Internal detail',
    };

    const result = toReportHistoryJob(raw);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(7);
    expect(result?.reportType).toBe('analytics_summary');
    expect(result?.state).toBe('completed');
    expect(result?.createdAt).toEqual(new Date('2026-08-10T10:00:00Z'));
    expect(result?.completedAt).toEqual(new Date('2026-08-10T10:05:00Z'));
    expect(result?.failedAt).toBeNull();
    expect(result?.expiresAt).toEqual(new Date('2026-09-09T10:00:00Z'));
    expect(result && 'artifactKey' in result).toBe(false);
    expect(result && 'failureCode' in result).toBe(false);
    expect(result && 'failureMessage' in result).toBe(false);
  });

  it('returns null when required fields are missing', () => {
    expect(toReportHistoryJob({ id: 7 })).toBeNull();
    expect(toReportHistoryJob({ id: 7, reportType: 'analytics_summary' })).toBeNull();
    expect(toReportHistoryJob({ id: 7, reportType: 'analytics_summary', locale: 'en' })).toBeNull();
    expect(
      toReportHistoryJob({
        id: 7,
        reportType: 'analytics_summary',
        locale: 'en',
        state: 'pending',
      }),
    ).toBeNull();
  });
});

describe('hasActiveReportJobs', () => {
  it('returns true when any job is pending or processing', () => {
    expect(hasActiveReportJobs([job({ state: 'pending' })])).toBe(true);
    expect(hasActiveReportJobs([job({ state: 'processing' })])).toBe(true);
    expect(hasActiveReportJobs([job({ state: 'completed' }), job({ state: 'processing' })])).toBe(
      true,
    );
  });

  it('returns false when all jobs are terminal or the list is empty', () => {
    expect(hasActiveReportJobs([])).toBe(false);
    expect(
      hasActiveReportJobs([
        job({ state: 'completed' }),
        job({ state: 'failed' }),
        job({ state: 'expired' }),
      ]),
    ).toBe(false);
  });
});

describe('isReportExpired', () => {
  const now = new Date('2026-08-20T00:00:00Z');

  it('treats the expired state as unavailable', () => {
    expect(isReportExpired(job({ state: 'expired' }), now)).toBe(true);
  });

  it('treats a completed job past its expiry as unavailable', () => {
    expect(isReportExpired(job({ expiresAt: new Date('2026-08-10T00:00:00Z') }), now)).toBe(true);
  });

  it('keeps a completed job before its expiry available', () => {
    expect(isReportExpired(job({ expiresAt: new Date('2026-09-09T00:00:00Z') }), now)).toBe(false);
  });

  it('never treats pending, processing, or failed jobs as expired', () => {
    expect(isReportExpired(job({ state: 'pending', expiresAt: null }), now)).toBe(false);
    expect(isReportExpired(job({ state: 'processing', expiresAt: null }), now)).toBe(false);
    expect(isReportExpired(job({ state: 'failed', expiresAt: null }), now)).toBe(false);
  });
});

describe('isReportDownloadable', () => {
  const now = new Date('2026-08-20T00:00:00Z');

  it('allows completed jobs before expiry', () => {
    expect(isReportDownloadable(job(), now)).toBe(true);
  });

  it('blocks expired, pending, processing, and failed jobs', () => {
    expect(isReportDownloadable(job({ expiresAt: new Date('2026-08-01T00:00:00Z') }), now)).toBe(
      false,
    );
    expect(isReportDownloadable(job({ state: 'expired' }), now)).toBe(false);
    expect(isReportDownloadable(job({ state: 'pending', expiresAt: null }), now)).toBe(false);
    expect(isReportDownloadable(job({ state: 'processing', expiresAt: null }), now)).toBe(false);
    expect(isReportDownloadable(job({ state: 'failed', expiresAt: null }), now)).toBe(false);
  });
});
