import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSLAAlertEmail } from '@/lib/email';
import { Resend } from 'resend';

const { sendMock, mockResendInstance, MockResend } = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  class MockResend {
    emails = { send };
  }
  return {
    sendMock: send,
    MockResend,
    mockResendInstance: new MockResend(),
  };
});

vi.mock('resend', () => {
  return {
    Resend: MockResend,
  };
});

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));

describe('SLA Alert Email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockClear();
  });

  it('should send SLA breach email with correct parameters', async () => {
    await sendSLAAlertEmail({
      adminEmail: 'admin@university.ac.id',
      adminName: 'Admin User',
      assignmentTitle: 'Thesis 2026',
      studentName: 'Alice',
      checkpointName: 'Chapter 1',
      breachDays: 3,
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@university.ac.id',
        subject: expect.stringContaining('SLA'),
        html: expect.stringContaining('Thesis 2026'),
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

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Research Paper'),
      }),
    );
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

    const htmlArg = sendMock.mock.calls[0][0].html;
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

    const htmlArg = sendMock.mock.calls[0][0].html;
    expect(htmlArg).toContain('7 days');
  });

  it('should throw an error if email sending fails', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'Error', message: 'Failed to send' },
    });

    await expect(
      sendSLAAlertEmail({
        adminEmail: 'fail@test.com',
        adminName: 'Fail',
        assignmentTitle: 'Test',
        studentName: 'User',
        checkpointName: 'CP1',
        breachDays: 1,
      }),
    ).rejects.toThrow('Failed to send SLA alert email: Failed to send');
  });
});
