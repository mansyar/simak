import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { AlertBanner } from '@/components/ui/alert-banner';

describe('AlertBanner', () => {
  it('renders with success variant', () => {
    render(
      <AlertBanner variant="success" title="Success">
        Operation completed
      </AlertBanner>,
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('renders with error variant', () => {
    render(
      <AlertBanner variant="error" title="Error">
        Something went wrong
      </AlertBanner>,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders with info variant', () => {
    render(
      <AlertBanner variant="info" title="Info">
        Here is some information
      </AlertBanner>,
    );
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Here is some information')).toBeInTheDocument();
  });

  it('renders with warning variant', () => {
    render(
      <AlertBanner variant="warning" title="Warning">
        Please be careful
      </AlertBanner>,
    );
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Please be careful')).toBeInTheDocument();
  });

  it('renders without description', () => {
    const { container } = render(<AlertBanner variant="info" title="Title Only" />);
    expect(screen.getByText('Title Only')).toBeInTheDocument();
    // Only one <p> element should exist (the title), no second paragraph for description
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
  });

  it('applies success design tokens', () => {
    render(<AlertBanner variant="success" title="Success" />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-success/10', 'text-success');
  });

  it('applies error design tokens', () => {
    render(<AlertBanner variant="error" title="Error" />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-destructive/10', 'text-destructive');
  });

  it('applies custom className', () => {
    render(<AlertBanner variant="info" title="Title" className="custom-class" />);
    expect(screen.getByRole('alert')).toHaveClass('custom-class');
  });

  it('renders children content', () => {
    render(
      <AlertBanner variant="info" title="Title">
        <p>Child paragraph</p>
      </AlertBanner>,
    );
    expect(screen.getByText('Child paragraph')).toBeInTheDocument();
  });
});
