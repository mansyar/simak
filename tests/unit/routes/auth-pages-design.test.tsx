/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useRouter: vi.fn().mockReturnValue({
    navigate: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// Mock auth-client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn() },
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

// Mock __root useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock useTheme
vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock LanguageSwitcher
vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

// Mock ThemeToggle
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe('Auth Pages - Design System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Page', () => {
    async function renderLogin() {
      const mod = await import('@/routes/_unauthenticated/auth/login');
      const Component = (mod.Route as any).component;
      return render(<Component />);
    }

    it('should render brand logo', async () => {
      await renderLogin();
      expect(screen.getByText('🎓 SIMAK')).toBeDefined();
    });

    it('should render language switcher', async () => {
      await renderLogin();
      expect(screen.getByTestId('language-switcher')).toBeDefined();
    });

    it('should render theme toggle', async () => {
      await renderLogin();
      expect(screen.getByTestId('theme-toggle')).toBeDefined();
    });

    it('should render email and password inputs', async () => {
      await renderLogin();
      expect(screen.getByLabelText('auth.email')).toBeDefined();
      expect(screen.getByLabelText('auth.password')).toBeDefined();
    });

    it('should render sign in button', async () => {
      await renderLogin();
      expect(screen.getByRole('button', { name: 'auth.signIn' })).toBeDefined();
    });

    it('should render forgot password link', async () => {
      await renderLogin();
      expect(screen.getByText('auth.forgotPassword')).toBeDefined();
    });
  });

  describe('Forgot Password Page', () => {
    async function renderForgot() {
      const mod = await import('@/routes/_unauthenticated/auth/forgot-password');
      const Component = (mod.Route as any).component;
      return render(<Component />);
    }

    it('should render language switcher and theme toggle', async () => {
      await renderForgot();
      expect(screen.getByTestId('language-switcher')).toBeDefined();
      expect(screen.getByTestId('theme-toggle')).toBeDefined();
    });

    it('should render email input', async () => {
      await renderForgot();
      expect(screen.getByLabelText('auth.email')).toBeDefined();
    });

    it('should render submit button', async () => {
      await renderForgot();
      expect(screen.getByRole('button', { name: 'common.submit' })).toBeDefined();
    });
  });

  describe('Verify 2FA Page', () => {
    async function render2FA() {
      const mod = await import('@/routes/_unauthenticated/auth/verify-2fa');
      const Component = (mod.Route as any).component;
      return render(<Component />);
    }

    it('should render language switcher and theme toggle', async () => {
      await render2FA();
      expect(screen.getByTestId('language-switcher')).toBeDefined();
      expect(screen.getByTestId('theme-toggle')).toBeDefined();
    });

    it('should render TOTP code input', async () => {
      await render2FA();
      expect(screen.getByLabelText('auth.totpCode')).toBeDefined();
    });

    it('should render verify button', async () => {
      await render2FA();
      expect(screen.getByRole('button', { name: 'common.verify' })).toBeDefined();
    });

    it('should render backup code link', async () => {
      await render2FA();
      expect(screen.getByText('auth.useBackupCode')).toBeDefined();
    });
  });

  describe('Verify Backup Code Page', () => {
    async function renderBackup() {
      const mod = await import('@/routes/_unauthenticated/auth/verify-backup-code');
      const Component = (mod.Route as any).component;
      return render(<Component />);
    }

    it('should render language switcher and theme toggle', async () => {
      await renderBackup();
      expect(screen.getByTestId('language-switcher')).toBeDefined();
      expect(screen.getByTestId('theme-toggle')).toBeDefined();
    });

    it('should render backup code input', async () => {
      await renderBackup();
      expect(screen.getByLabelText('auth.backupCode')).toBeDefined();
    });

    it('should render verify button', async () => {
      await renderBackup();
      expect(screen.getByRole('button', { name: 'common.verify' })).toBeDefined();
    });

    it('should render TOTP code link', async () => {
      await renderBackup();
      expect(screen.getByText('auth.useTotpCode')).toBeDefined();
    });
  });
});
