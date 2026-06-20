import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UserPlus } from 'lucide-react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
}));

import { QuickActionCard } from '@/components/ui/quick-action-card';

describe('QuickActionCard', () => {
  it('renders label and description', () => {
    render(
      <QuickActionCard
        icon={UserPlus}
        label="Manage Users"
        description="Create and manage user accounts"
        to="/admin/users"
      />,
    );
    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByText('Create and manage user accounts')).toBeInTheDocument();
  });

  it('renders as a link with the correct href', () => {
    render(
      <QuickActionCard
        icon={UserPlus}
        label="Manage Users"
        description="Create and manage user accounts"
        to="/admin/users"
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/users');
  });

  it('applies hover and transition classes', () => {
    render(
      <QuickActionCard
        icon={UserPlus}
        label="Manage Users"
        description="Description"
        to="/admin/users"
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveClass('transition-all', 'duration-200');
  });

  it('applies custom className', () => {
    render(
      <QuickActionCard
        icon={UserPlus}
        label="Manage Users"
        description="Description"
        to="/admin/users"
        className="custom-class"
      />,
    );
    expect(screen.getByRole('link')).toHaveClass('custom-class');
  });

  it('renders the icon', () => {
    render(
      <QuickActionCard
        icon={UserPlus}
        label="Manage Users"
        description="Description"
        to="/admin/users"
      />,
    );
    const link = screen.getByRole('link');
    expect(link.querySelector('svg')).toBeInTheDocument();
  });
});
