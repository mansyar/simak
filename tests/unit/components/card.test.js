import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
describe('Card', () => {
  it('renders children correctly', () => {
    render(_jsx(Card, { children: 'Card content' }));
    expect(screen.getByText('Card content')).toBeDefined();
  });
  it('renders with default size data attribute', () => {
    const { container } = render(_jsx(Card, { children: 'Content' }));
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.getAttribute('data-size')).toBe('default');
  });
  it('renders with sm size when specified', () => {
    const { container } = render(_jsx(Card, { size: 'sm', children: 'Content' }));
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.getAttribute('data-size')).toBe('sm');
  });
  it('applies custom className', () => {
    const { container } = render(_jsx(Card, { className: 'custom-class', children: 'Content' }));
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.className).toContain('custom-class');
  });
});
describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(_jsx(Card, { children: _jsx(CardHeader, { children: 'Header content' }) }));
    expect(screen.getByText('Header content')).toBeDefined();
  });
});
describe('CardTitle', () => {
  it('renders with font-sans class', () => {
    const { container } = render(
      _jsx(Card, {
        children: _jsx(CardHeader, { children: _jsx(CardTitle, { children: 'Title' }) }),
      }),
    );
    const title = container.querySelector('[data-slot="card-title"]');
    expect(title).toBeDefined();
    expect(title?.className).toContain('font-sans');
    expect(title?.className).not.toContain('font-heading');
  });
});
describe('CardDescription', () => {
  it('renders description text', () => {
    render(
      _jsx(Card, {
        children: _jsx(CardHeader, {
          children: _jsx(CardDescription, { children: 'Description text' }),
        }),
      }),
    );
    expect(screen.getByText('Description text')).toBeDefined();
  });
});
describe('CardAction', () => {
  it('renders action content', () => {
    render(
      _jsx(Card, {
        children: _jsx(CardHeader, {
          children: _jsx(CardAction, { children: _jsx('button', { children: 'Action' }) }),
        }),
      }),
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeDefined();
  });
});
describe('CardContent', () => {
  it('renders content correctly', () => {
    render(_jsx(Card, { children: _jsx(CardContent, { children: 'Body content' }) }));
    expect(screen.getByText('Body content')).toBeDefined();
  });
});
describe('CardFooter', () => {
  it('renders footer content', () => {
    render(_jsx(Card, { children: _jsx(CardFooter, { children: 'Footer' }) }));
    expect(screen.getByText('Footer')).toBeDefined();
  });
});
