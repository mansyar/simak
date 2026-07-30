/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => config),
  Link: vi.fn().mockReturnValue(null),
  useRouter: vi.fn().mockReturnValue({
    navigate: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// Mock auth-client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    twoFactor: {
      verifyTotp: vi.fn(),
      verifyBackupCode: vi.fn(),
    },
  },
}));

// Mock server setup-password
vi.mock('@/server/setup-password', () => ({
  completePasswordSetup: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/login');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/login');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('Forgot Password Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/forgot-password');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/forgot-password');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('Reset Password Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/reset-password');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/reset-password');
      expect(Route).toHaveProperty('component');
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/reset-password');
      expect(Route).toHaveProperty('validateSearch');
    });
  });

  describe('Setup Password Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/setup-password');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/setup-password');
      expect(Route).toHaveProperty('component');
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/setup-password');
      expect(Route).toHaveProperty('validateSearch');
    });
  });

  describe('Verify 2FA Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/verify-2fa');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/verify-2fa');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('Verify Backup Code Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/verify-backup-code');
      expect(Route).toBeDefined();
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated/auth/verify-backup-code');
      expect(Route).toHaveProperty('component');
    });
  });
});
