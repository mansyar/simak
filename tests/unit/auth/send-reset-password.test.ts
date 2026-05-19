import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock before any imports - hoisted by vitest
const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSend,
}));

describe('sendResetPassword callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendPasswordResetEmail with correct params', async () => {
    const { auth } = await import('@/auth/config');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailPw = (auth.options as any).emailAndPassword;

    await emailPw.sendResetPassword({
      user: { email: 'test@example.com', name: 'Test', id: 'u1' },
      url: 'http://localhost:3000/auth/reset-password?token=abc123',
      token: 'abc123',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test',
      token: 'abc123',
    });
  });

  it('should handle missing token in URL gracefully', async () => {
    const { auth } = await import('@/auth/config');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailPw = (auth.options as any).emailAndPassword;

    await emailPw.sendResetPassword({
      user: { email: 'user@test.com', name: 'User', id: 'u2' },
      url: 'http://localhost:3000/auth/reset-password',
      token: '',
    });

    expect(mockSend).toHaveBeenCalledWith({
      email: 'user@test.com',
      name: 'User',
      token: '',
    });
  });
});
