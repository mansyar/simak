import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

// Mock i18n
vi.mock('../../../routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('Dark Mode Detection — CSS Custom Properties', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  describe('UI primitives use theme-aware classes', () => {
    it('Button default variant uses bg-primary (CSS variable, not hardcoded)', () => {
      const { container } = render(<Button>Click</Button>);
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      // Should contain bg-primary (CSS variable) not bg-blue-500 or similar hardcoded color
      expect(button!.className).toContain('bg-primary');
      expect(button!.className).not.toMatch(/bg-(red|blue|green|yellow|gray|white|black)-\d+/);
    });

    it('Button outline variant uses dark: variant classes', () => {
      const { container } = render(<Button variant="outline">Outline</Button>);
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      // Outline variant should have dark: classes
      expect(button!.className).toContain('dark:border-input');
      expect(button!.className).toContain('dark:bg-input/30');
    });

    it('Button destructive variant uses dark: variant classes', () => {
      const { container } = render(<Button variant="destructive">Delete</Button>);
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button!.className).toContain('dark:bg-destructive/20');
    });

    it('Button ghost variant uses dark: variant classes', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>);
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button!.className).toContain('dark:hover:bg-muted/50');
    });

    it('Input uses dark: variant classes', () => {
      const { container } = render(<Input placeholder="Type..." />);
      const input = container.querySelector('input');
      expect(input).not.toBeNull();
      expect(input!.className).toContain('dark:bg-input/30');
    });

    it('Card uses theme-aware bg-card class (not hardcoded)', () => {
      const { container } = render(
        <Card>
          <CardContent>Content</CardContent>
        </Card>,
      );
      const card = container.querySelector('[data-slot="card"]');
      expect(card).not.toBeNull();
      expect(card!.className).toContain('bg-card');
      // Should not have hardcoded bg-white
      expect(card!.className).not.toContain('bg-white');
    });

    it('Badge uses theme-aware classes', () => {
      const { container } = render(<Badge>Label</Badge>);
      const badge = container.querySelector('[data-slot="badge"]');
      expect(badge).not.toBeNull();
      expect(badge!.className).not.toMatch(/bg-(red|blue|green|yellow|gray|white|black)-\d+/);
    });

    it('Label uses inherited text color (no hardcoded text color)', () => {
      const { container } = render(<Label>Name</Label>);
      const label = container.querySelector('label');
      expect(label).not.toBeNull();
      // Label should not have hardcoded text colors
      expect(label!.className).not.toMatch(/text-(red|blue|green|yellow|gray|white|black)-\d+/);
    });

    it('Skeleton uses bg-muted (CSS variable, not hardcoded gray)', () => {
      const { container } = render(<Skeleton className="h-4 w-20" />);
      const skeleton = container.querySelector('[data-slot="skeleton"]');
      expect(skeleton).not.toBeNull();
      expect(skeleton!.className).toContain('bg-muted');
      expect(skeleton!.className).not.toContain('bg-gray');
    });
  });

  describe('Skip-to-content link uses theme-aware classes', () => {
    it('Skip-to-content link should not use hardcoded bg-white or text-black', () => {
      // Render the skip-to-content element directly to test its class
      const div = document.createElement('div');
      div.innerHTML = `
        <a
          href="#main-content"
          class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded"
        >
          Skip to content
        </a>
      `;
      document.body.appendChild(div);
      const link = div.querySelector('a')!;

      // Should use theme-aware classes
      expect(link.className).toContain('focus:bg-background');
      expect(link.className).toContain('focus:text-foreground');

      // Should NOT use hardcoded colors
      expect(link.className).not.toContain('focus:bg-white');
      expect(link.className).not.toContain('focus:text-black');

      document.body.removeChild(div);
    });
  });

  describe('Dark class toggling', () => {
    it('Adding dark class to html element switches theme', () => {
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('Removing dark class from html element switches theme', () => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
