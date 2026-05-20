import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendInvitationEmail, sendPasswordResetEmail } from '@/lib/email';
import { Resend } from 'resend';
import { getEnv } from '@/config/env';

const { sendMock, mockResendInstance, MockResend } = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  class MockResend {
    emails = { send };
  }
  return { 
    sendMock: send,
    MockResend,
    mockResendInstance: new MockResend()
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

describe('Email library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Since it's a singleton mockResendInstance, we need to clear the mock function manually if clearAllMocks doesn't catch it
    sendMock.mockClear();
  });

  it('should send an invitation email with correct parameters', async () => {
    const params = {
      email: 'test@example.com',
      name: 'Test User',
      token: 'test-token',
    };

    await sendInvitationEmail(params);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: params.email,
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('http://localhost:3000/auth/setup-password?token=test-token'),
      })
    );
  });

  it('should send a password reset email with correct parameters', async () => {
    const params = {
      email: 'reset@example.com',
      name: 'Reset User',
      token: 'reset-token',
    };

    await sendPasswordResetEmail(params);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: params.email,
        subject: expect.stringContaining('Reset'),
        html: expect.stringContaining('http://localhost:3000/auth/reset-password?token=reset-token'),
      })
    );
  });

  it('should throw an error if email sending fails', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'Error', message: 'Failed to send' },
    });

    const params = {
      email: 'fail@example.com',
      name: 'Fail User',
      token: 'fail-token',
    };

    await expect(sendInvitationEmail(params)).rejects.toThrow('Failed to send invitation email: Failed to send');
  });
});
