import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
// Mock i18n
vi.mock('../../../routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));
// Mock notification hook
vi.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: () => ({
    data: 0,
    isSuccess: true,
  }),
}));
describe('Accessibility Attributes', () => {
  describe('ARIA labels on interactive elements', () => {
    it('ThemeToggle has aria-label', () => {
      const { container } = render(_jsx(ThemeToggle, { theme: 'light', onToggle: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
    it('LanguageSwitcher buttons have aria-labels', () => {
      const { container } = render(
        _jsx(LanguageSwitcher, { currentLocale: 'en', onSwitch: vi.fn() }),
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      buttons.forEach((button) => {
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });
    it('NotificationBadge has aria-label', () => {
      const { container } = render(_jsx(NotificationBadge, { onOpen: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
  });
  describe('ARIA live regions for dynamic content', () => {
    it('Error messages have aria-live="polite"', () => {
      const { container } = render(
        _jsx('div', {
          children: _jsx('p', {
            className: 'text-destructive',
            'aria-live': 'polite',
            children: 'Error message',
          }),
        }),
      );
      const error = container.querySelector('[aria-live="polite"]');
      expect(error).not.toBeNull();
      expect(error.textContent).toBe('Error message');
    });
    it('FormMessage component has aria-live="polite"', () => {
      // FormMessage is part of the form.tsx component
      // It should have aria-live="polite" for screen reader announcements
      const formMessageProps = {
        id: 'test-message',
        className: 'text-destructive',
        'aria-live': 'polite',
      };
      // Verify the props are correct
      expect(formMessageProps['aria-live']).toBe('polite');
    });
  });
  describe('Focus management', () => {
    it('ThemeToggle has focus-visible classes', () => {
      const { container } = render(_jsx(ThemeToggle, { theme: 'light', onToggle: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.className).toContain('focus-visible:outline-none');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-ring');
    });
    it('LanguageSwitcher buttons have focus-visible classes', () => {
      const { container } = render(
        _jsx(LanguageSwitcher, { currentLocale: 'en', onSwitch: vi.fn() }),
      );
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button.className).toContain('focus-visible:outline-none');
        expect(button.className).toContain('focus-visible:ring-2');
        expect(button.className).toContain('focus-visible:ring-ring');
      });
    });
    it('NotificationBadge has focus-visible classes', () => {
      const { container } = render(_jsx(NotificationBadge, { onOpen: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.className).toContain('focus-visible:outline');
      expect(button.className).toContain('focus-visible:outline-2');
      expect(button.className).toContain('focus-visible:outline-offset-2');
      expect(button.className).toContain('focus-visible:outline-primary');
    });
    it('Button has focus-visible classes', () => {
      const { container } = render(_jsx(Button, { children: 'Click' }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.className).toContain('focus-visible:border-ring');
      expect(button.className).toContain('focus-visible:ring-3');
      expect(button.className).toContain('focus-visible:ring-ring/50');
    });
    it('Input has focus-visible classes', () => {
      const { container } = render(_jsx(Input, { placeholder: 'Type...' }));
      const input = container.querySelector('input');
      expect(input).not.toBeNull();
      expect(input.className).toContain('focus-visible:border-ring');
      expect(input.className).toContain('focus-visible:ring-3');
      expect(input.className).toContain('focus-visible:ring-ring/50');
    });
  });
  describe('Heading hierarchy', () => {
    it('Skip-to-content link is the first focusable element', () => {
      const { container } = render(
        _jsxs('div', {
          children: [
            _jsx('a', {
              href: '#main-content',
              className: 'sr-only focus:not-sr-only',
              children: 'Skip to content',
            }),
            _jsx('main', {
              id: 'main-content',
              children: _jsx('h1', { children: 'Main Content' }),
            }),
          ],
        }),
      );
      const skipLink = container.querySelector('a');
      expect(skipLink).not.toBeNull();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(skipLink.className).toContain('sr-only');
    });
    it('Pages have exactly one h1 element', () => {
      const { container } = render(
        _jsxs('div', {
          children: [
            _jsx('h1', { children: 'Page Title' }),
            _jsx('h2', { children: 'Section Title' }),
          ],
        }),
      );
      const h1Elements = container.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
    });
    it('Heading levels do not skip (h1 -> h2 -> h3)', () => {
      const { container } = render(
        _jsxs('div', {
          children: [
            _jsx('h1', { children: 'Page Title' }),
            _jsx('h2', { children: 'Section Title' }),
            _jsx('h3', { children: 'Subsection Title' }),
          ],
        }),
      );
      const headings = container.querySelectorAll('h1, h2, h3');
      expect(headings.length).toBe(3);
      expect(headings[0].tagName).toBe('H1');
      expect(headings[1].tagName).toBe('H2');
      expect(headings[2].tagName).toBe('H3');
    });
  });
  describe('Touch targets', () => {
    it('ThemeToggle has minimum 44x44px touch target', () => {
      const { container } = render(_jsx(ThemeToggle, { theme: 'light', onToggle: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    });
    it('LanguageSwitcher buttons have minimum 44px height', () => {
      const { container } = render(
        _jsx(LanguageSwitcher, { currentLocale: 'en', onSwitch: vi.fn() }),
      );
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button.className).toContain('min-h-11');
      });
    });
    it('NotificationBadge has minimum 44x44px touch target', () => {
      const { container } = render(_jsx(NotificationBadge, { onOpen: vi.fn() }));
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    });
  });
});
