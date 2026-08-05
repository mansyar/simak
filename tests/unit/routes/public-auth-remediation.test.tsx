/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: unknown) => config),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouter: vi.fn().mockReturnValue({
    navigate: mocks.navigate,
    invalidate: mocks.invalidate,
  }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: mocks.signIn },
  },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <button aria-label="Switch language">Language</button>,
}));

vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <button aria-label="Toggle theme">Theme</button>,
}));

async function renderLogin() {
  const module = await import('@/routes/_unauthenticated/auth/login');
  const Component = (module.Route as unknown as { component: React.ComponentType }).component;
  return render(<Component />);
}

describe('Public authentication remediation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows linked field-level errors when the login form is blank', async () => {
    const { container } = await renderLogin();
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('auth.emailRequired')).toBeDefined();
    expect(screen.getByText('auth.passwordRequired')).toBeDefined();
    expect(screen.getByLabelText('auth.email').getAttribute('aria-describedby')).toBe(
      'email-error',
    );
    expect(screen.getByLabelText('auth.password').getAttribute('aria-describedby')).toBe(
      'password-error',
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('localizes authentication failures without exposing the server message', async () => {
    mocks.signIn.mockResolvedValue({ error: { message: 'Invalid email' } });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('auth.email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.signIn' }).closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('auth.invalidCredentials');
    expect(alert.textContent).not.toContain('Invalid email');
  });

  it('announces and disables the sign-in action while submitting', async () => {
    let resolveSignIn!: (value: unknown) => void;
    mocks.signIn.mockReturnValue(new Promise((resolve) => (resolveSignIn = resolve)));
    await renderLogin();

    fireEvent.change(screen.getByLabelText('auth.email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
    const button = screen.getByRole('button', { name: 'auth.signIn' });
    fireEvent.submit(button.closest('form')!);

    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.textContent).toContain('auth.signingIn');

    resolveSignIn({ data: {} });
  });
});
