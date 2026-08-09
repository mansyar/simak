/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadReportHandler,
  getReportHistoryHandler,
  getReportStatusHandler,
  processReportJob,
  requestReportHandler,
  retryReportHandler,
  type ReportOrchestrationDependencies,
} from '@/server/reporting-orchestration.server';

const filters = { termId: null, courseId: null, sectionId: null, cohort: null };
const session = { user: { id: 'admin-1', role: 'admin' } };
const pendingJob = {
  id: 41,
  reportType: 'analytics_summary' as const,
  requesterId: 'admin-1',
  parameters: filters,
  locale: 'en' as const,
  state: 'pending' as const,
  attempts: 0,
  artifactKey: null,
  artifactSizeBytes: null,
  artifactSha256: null,
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-08-10T10:00:00Z'),
  updatedAt: new Date('2026-08-10T10:00:00Z'),
  startedAt: null,
  completedAt: null,
  failedAt: null,
  expiresAt: null,
};

function dependencies(overrides: Partial<ReportOrchestrationDependencies> = {}) {
  const deps: ReportOrchestrationDependencies = {
    getSession: vi.fn().mockResolvedValue(session),
    authorizeAndLoad: vi.fn().mockResolvedValue({ filters, sections: [] }),
    insertJob: vi.fn().mockResolvedValue(pendingJob),
    findOwnedJob: vi.fn().mockResolvedValue(pendingJob),
    listOwnedJobs: vi.fn().mockResolvedValue([pendingJob]),
    claimJob: vi.fn().mockResolvedValue({ ...pendingJob, state: 'processing', attempts: 1 }),
    completeJob: vi.fn().mockResolvedValue({ ...pendingJob, state: 'completed' }),
    failJob: vi.fn().mockResolvedValue({ ...pendingJob, state: 'failed' }),
    resetFailedJob: vi.fn().mockResolvedValue(pendingJob),
    renderPdf: vi.fn().mockResolvedValue(Buffer.from('pdf')),
    storeArtifact: vi.fn().mockResolvedValue({
      artifactKey: 'reports/opaque.pdf',
      artifactSizeBytes: 3,
      artifactSha256: 'abc',
    }),
    deleteArtifact: vi.fn().mockResolvedValue('deleted'),
    createDownloadUrl: vi.fn().mockResolvedValue('https://signed.example/report'),
    audit: vi.fn().mockResolvedValue(undefined),
    log: { info: vi.fn(), error: vi.fn() },
    now: vi.fn().mockReturnValue(new Date('2026-08-10T11:00:00Z')),
    ...overrides,
  };
  return deps;
}

describe('report generation orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authorizes type and filters before inserting a pending durable job', async () => {
    const deps = dependencies();
    const result = await requestReportHandler(
      { data: { reportType: 'analytics_summary', locale: 'en', filters } },
      deps,
    );

    expect(result).toMatchObject({ job: { id: 41, state: 'completed' } });
    expect(deps.authorizeAndLoad).toHaveBeenCalledWith('analytics_summary', filters, 'admin-1');
    expect(deps.authorizeAndLoad).toHaveBeenCalledTimes(2);
    expect(deps.insertJob).toHaveBeenCalledWith({
      reportType: 'analytics_summary',
      requesterId: 'admin-1',
      parameters: filters,
      locale: 'en',
    });
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_requested', entityId: '41' }),
    );
  });

  it('rejects a role/type mismatch without inserting a job', async () => {
    const deps = dependencies({
      getSession: vi.fn().mockResolvedValue({ user: { id: 'student-1', role: 'student' } }),
    });

    await expect(
      requestReportHandler(
        { data: { reportType: 'analytics_summary', locale: 'en', filters } },
        deps,
      ),
    ).resolves.toEqual({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    expect(deps.authorizeAndLoad).not.toHaveBeenCalled();
    expect(deps.insertJob).not.toHaveBeenCalled();
  });

  it('claims, reloads authoritative data, renders, uploads, then completes', async () => {
    const deps = dependencies();
    const result = await processReportJob(41, 'admin-1', deps);

    expect(result).toMatchObject({ state: 'completed' });
    expect(deps.claimJob).toHaveBeenCalledWith(41);
    expect(deps.authorizeAndLoad).toHaveBeenCalledWith('analytics_summary', filters, 'admin-1');
    expect(deps.renderPdf).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'analytics_summary', locale: 'en' }),
    );
    expect(deps.storeArtifact).toHaveBeenCalledWith(Buffer.from('pdf'));
    expect(deps.completeJob).toHaveBeenCalledWith(41, {
      artifactKey: 'reports/opaque.pdf',
      artifactSizeBytes: 3,
      artifactSha256: 'abc',
    });
  });

  it('does no generation work when another execution already claimed the job', async () => {
    const deps = dependencies({ claimJob: vi.fn().mockResolvedValue(null) });

    await expect(processReportJob(41, 'admin-1', deps)).resolves.toBeNull();
    expect(deps.authorizeAndLoad).not.toHaveBeenCalled();
    expect(deps.renderPdf).not.toHaveBeenCalled();
    expect(deps.storeArtifact).not.toHaveBeenCalled();
  });

  it('marks a privacy-safe failure and never exposes the thrown error', async () => {
    const deps = dependencies({
      renderPdf: vi.fn().mockRejectedValue(new Error('student@example.com failed')),
    });

    await expect(processReportJob(41, 'admin-1', deps)).resolves.toMatchObject({ state: 'failed' });
    expect(deps.failJob).toHaveBeenCalledWith(41, {
      code: 'generation_failed',
      message: 'Report generation failed',
    });
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_generation_failed',
        details: { reportType: 'analytics_summary', attempts: 0 },
      }),
    );
    expect(deps.log.error).toHaveBeenCalledWith({
      event: 'report_generation_failed',
      reportJobId: 41,
      reportType: 'analytics_summary',
    });
    expect(JSON.stringify(vi.mocked(deps.log.error).mock.calls)).not.toContain(
      'student@example.com',
    );
  });

  it('uses the attempt count returned by the guarded fail transition for the audit', async () => {
    const deps = dependencies({
      renderPdf: vi.fn().mockRejectedValue(new Error('render blew up')),
      failJob: vi.fn().mockResolvedValue({ ...pendingJob, state: 'failed', attempts: 3 }),
    });

    await expect(processReportJob(41, 'admin-1', deps)).resolves.toMatchObject({ state: 'failed' });
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_generation_failed',
        details: { reportType: 'analytics_summary', attempts: 3 },
      }),
    );
  });

  it('skips the failure audit when another execution already resolved the job', async () => {
    const deps = dependencies({
      renderPdf: vi.fn().mockRejectedValue(new Error('render blew up')),
      failJob: vi.fn().mockResolvedValue(null),
    });

    await expect(processReportJob(41, 'admin-1', deps)).resolves.toBeNull();
    expect(deps.audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_generation_failed' }),
    );
    expect(deps.log.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'report_generation_failed' }),
    );
  });

  it('does not authorize or generate when the claimed requester differs from the caller', async () => {
    const deps = dependencies();

    await expect(processReportJob(41, 'other-admin', deps)).resolves.toMatchObject({
      state: 'failed',
    });
    expect(deps.authorizeAndLoad).not.toHaveBeenCalled();
    expect(deps.renderPdf).not.toHaveBeenCalled();
    expect(deps.storeArtifact).not.toHaveBeenCalled();
    expect(deps.failJob).toHaveBeenCalledWith(41, {
      code: 'generation_failed',
      message: 'Report generation failed',
    });
  });

  it.each(['throws', 'returns stale'] as const)(
    'deletes an uploaded artifact when completion %s',
    async (failureMode) => {
      const deps = dependencies({
        completeJob:
          failureMode === 'throws'
            ? vi.fn().mockRejectedValue(new Error('database unavailable'))
            : vi.fn().mockResolvedValue(null),
      });

      await expect(processReportJob(41, 'admin-1', deps)).resolves.toMatchObject({
        state: 'failed',
      });
      expect(deps.deleteArtifact).toHaveBeenCalledWith('reports/opaque.pdf');
      expect(deps.failJob).toHaveBeenCalledWith(41, {
        code: 'generation_failed',
        message: 'Report generation failed',
      });
    },
  );

  it('does not let artifact cleanup failure mask the safe job failure', async () => {
    const deps = dependencies({
      completeJob: vi.fn().mockRejectedValue(new Error('database unavailable')),
      deleteArtifact: vi.fn().mockRejectedValue(new Error('R2 unavailable')),
    });

    await expect(processReportJob(41, 'admin-1', deps)).resolves.toMatchObject({ state: 'failed' });
    expect(deps.failJob).toHaveBeenCalled();
    expect(deps.log.error).toHaveBeenCalledWith({
      event: 'report_artifact_cleanup_failed',
      reportJobId: 41,
      reportType: 'analytics_summary',
    });
  });

  it('uses the same not-found response for missing and unowned status', async () => {
    const deps = dependencies({ findOwnedJob: vi.fn().mockResolvedValue(null) });

    await expect(getReportStatusHandler({ data: { jobId: 999 } }, deps)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Report not found' },
    });
  });

  it('returns bounded owner history without artifact keys', async () => {
    const deps = dependencies();

    const result = await getReportHistoryHandler({ data: { limit: 20 } }, deps);
    expect(deps.listOwnedJobs).toHaveBeenCalledWith('admin-1', 20);
    expect(result).toEqual({
      jobs: [expect.not.objectContaining({ artifactKey: expect.anything() })],
    });
  });

  it('rejects incomplete and expired downloads without presigning', async () => {
    const deps = dependencies();
    await expect(downloadReportHandler({ data: { jobId: 41 } }, deps)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Report not found' },
    });

    vi.mocked(deps.findOwnedJob).mockResolvedValue({
      ...pendingJob,
      state: 'completed',
      artifactKey: 'reports/opaque.pdf',
      expiresAt: new Date('2026-08-10T10:59:59Z'),
    });
    await expect(downloadReportHandler({ data: { jobId: 41 } }, deps)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Report not found' },
    });
    expect(deps.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('denies download for expired jobs even when the artifact key is retained', async () => {
    const deps = dependencies({
      findOwnedJob: vi.fn().mockResolvedValue({
        ...pendingJob,
        state: 'expired',
        artifactKey: 'reports/opaque.pdf',
        expiresAt: new Date('2026-08-10T10:00:00Z'),
      }),
    });

    await expect(downloadReportHandler({ data: { jobId: 41 } }, deps)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Report not found' },
    });
    expect(deps.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('presigns and audits an authorized completed download', async () => {
    const deps = dependencies({
      findOwnedJob: vi.fn().mockResolvedValue({
        ...pendingJob,
        state: 'completed',
        artifactKey: 'reports/opaque.pdf',
        expiresAt: new Date('2026-08-11T11:00:00Z'),
      }),
    });

    await expect(downloadReportHandler({ data: { jobId: 41 } }, deps)).resolves.toEqual({
      downloadUrl: 'https://signed.example/report',
    });
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_downloaded', entityId: '41' }),
    );
  });

  it('retries only an owned failed job and safely runs it again', async () => {
    const failed = { ...pendingJob, state: 'failed' as const };
    const deps = dependencies({ findOwnedJob: vi.fn().mockResolvedValue(failed) });

    await retryReportHandler({ data: { jobId: 41 } }, deps);
    expect(deps.resetFailedJob).toHaveBeenCalledWith(41);
    expect(deps.claimJob).toHaveBeenCalledWith(41);
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_retried', entityId: '41' }),
    );
  });

  it('does not retry an owned job in any other state', async () => {
    const deps = dependencies();

    await expect(retryReportHandler({ data: { jobId: 41 } }, deps)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Report not found' },
    });
    expect(deps.resetFailedJob).not.toHaveBeenCalled();
  });
});
