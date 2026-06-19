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
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeDefined();
  });

  it('renders with default size data attribute', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.getAttribute('data-size')).toBe('default');
  });

  it('renders with sm size when specified', () => {
    const { container } = render(<Card size="sm">Content</Card>);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.getAttribute('data-size')).toBe('sm');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeDefined();
    expect(card?.className).toContain('custom-class');
  });
});

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <CardHeader>Header content</CardHeader>
      </Card>,
    );
    expect(screen.getByText('Header content')).toBeDefined();
  });
});

describe('CardTitle', () => {
  it('renders with font-sans class', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
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
      <Card>
        <CardHeader>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText('Description text')).toBeDefined();
  });
});

describe('CardAction', () => {
  it('renders action content', () => {
    render(
      <Card>
        <CardHeader>
          <CardAction>
            <button>Action</button>
          </CardAction>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeDefined();
  });
});

describe('CardContent', () => {
  it('renders content correctly', () => {
    render(
      <Card>
        <CardContent>Body content</CardContent>
      </Card>,
    );
    expect(screen.getByText('Body content')).toBeDefined();
  });
});

describe('CardFooter', () => {
  it('renders footer content', () => {
    render(
      <Card>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Footer')).toBeDefined();
  });
});
