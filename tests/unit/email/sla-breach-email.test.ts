import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSLAAlertEmail } from '@/lib/email';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));

function createMockDb() {
  const values = vi.fn().mockReturnThis();
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values };
}

describe('SLA Alert Email', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  it('should enqueue SLA breach email with correct parameters', async () => {
    await sendSLAAlertEmail({
      adminEmail: 'admin@university.ac.id',
      adminName: 'Admin User',
      assignmentTitle: 'Thesis 2026',
      studentName: 'Alice',
      checkpointName: 'Chapter 1',
      breachDays: 3,
    });

    expect(mockDb.insert).toHaveBeenCalledWith(emailQueue);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'admin@university.ac.id',
        subject: expect.stringContaining('SLA'),
        templateType: 'sla_alert',
        status: 'pending',
        attempts: 0,
      }),
    );
  });

  it('should include assignment details in email body', async () => {
    await sendSLAAlertEmail({
      adminEmail: 'admin@test.com',
      adminName: 'Admin',
      assignmentTitle: 'Research Paper',
      studentName: 'Bob',
      checkpointName: 'Introduction',
      breachDays: 5,
    });

    const htmlArg = mockDb.values.mock.calls[0][0].bodyHtml;
    expect(htmlArg).toContain('Research Paper');
  });

  it('should include student and checkpoint names', async () => {
    await sendSLAAlertEmail({
      adminEmail: 'admin@test.com',
      adminName: 'Admin',
      assignmentTitle: 'Test',
      studentName: 'Charlie',
      checkpointName: 'Methodology',
      breachDays: 2,
    });

    const htmlArg = mockDb.values.mock.calls[0][0].bodyHtml;
    expect(htmlArg).toContain('Charlie');
    expect(htmlArg).toContain('Methodology');
  });

  it('should include breach duration in the email', async () => {
    await sendSLAAlertEmail({
      adminEmail: 'admin@test.com',
      adminName: 'Admin',
      assignmentTitle: 'Test',
      studentName: 'Diana',
      checkpointName: 'Conclusion',
      breachDays: 7,
    });

    const htmlArg = mockDb.values.mock.calls[0][0].bodyHtml;
    expect(htmlArg).toContain('7 days');
  });
});
