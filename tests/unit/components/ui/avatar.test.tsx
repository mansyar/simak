import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Avatar } from '@/components/ui/avatar';

describe('Avatar', () => {
  it('renders initials from a name', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders initials from a single name', () => {
    render(<Avatar name="John" />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('handles empty name gracefully', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('has aria-label with the name', () => {
    render(<Avatar name="Jane Smith" />);
    expect(screen.getByLabelText('Jane Smith')).toBeInTheDocument();
  });

  it('applies default size class', () => {
    render(<Avatar name="Test User" data-testid="avatar" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.className).toContain('size-10');
  });

  it('applies sm size class', () => {
    render(<Avatar name="Test User" size="sm" data-testid="avatar" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.className).toContain('size-8');
  });

  it('applies lg size class', () => {
    render(<Avatar name="Test User" size="lg" data-testid="avatar" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.className).toContain('size-12');
  });

  it('renders image when src is provided', () => {
    render(<Avatar name="John Doe" src="https://example.com/avatar.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'John Doe');
  });
});
