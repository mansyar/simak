import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceSection } from '@/components/settings/AppearanceSection';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.appearance.title': 'Appearance',
        'settings.appearance.description': 'Customize how the application looks',
        'settings.appearance.languageLabel': 'Language',
        'settings.appearance.themeLabel': 'Theme',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.toggle': 'Toggle theme',
        'language.en': 'English',
        'language.id': 'Bahasa Indonesia',
        'language.switch': 'Switch language',
        'language.switchToEnglish': 'Switch to English',
        'language.switchToIndonesian': 'Switch to Bahasa Indonesia',
      };
      return translations[key] || key;
    },
    locale: 'en',
    setLocale: mockSetLocale,
  }),
}));

const mockSetLocale = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: mockToggleTheme,
  }),
}));

describe('AppearanceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render language and theme labels', () => {
    render(<AppearanceSection />);

    expect(screen.getByText('Language')).toBeDefined();
    expect(screen.getByText('Theme')).toBeDefined();
  });

  it('should render EN and ID toggle buttons', () => {
    render(<AppearanceSection />);

    expect(screen.getByText('EN')).toBeDefined();
    expect(screen.getByText('ID')).toBeDefined();
  });

  it('should render theme toggle button', () => {
    render(<AppearanceSection />);

    const themeButton = screen.getByLabelText('Toggle theme');
    expect(themeButton).toBeDefined();
  });

  it('should call setLocale with "id" when ID button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);

    await user.click(screen.getByText('ID'));

    expect(mockSetLocale).toHaveBeenCalledWith('id');
  });

  it('should call setLocale with "en" when EN button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);

    await user.click(screen.getByText('EN'));

    expect(mockSetLocale).toHaveBeenCalledWith('en');
  });

  it('should call toggleTheme when theme button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);

    await user.click(screen.getByLabelText('Toggle theme'));

    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });
});
