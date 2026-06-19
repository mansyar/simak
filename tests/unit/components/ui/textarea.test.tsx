import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Textarea } from '@/components/ui/textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('renders with data-slot attribute', () => {
    const { container } = render(<Textarea />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.getAttribute('data-slot')).toBe('textarea');
  });

  it('applies default height class', () => {
    const { container } = render(<Textarea />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('min-h-[80px]');
  });

  it('accepts a value prop', () => {
    render(<Textarea value="hello" readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('calls onChange when value changes', () => {
    let value = '';
    render(
      <Textarea
        value={value}
        onChange={(e) => {
          value = e.target.value;
        }}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new text' } });
    expect(value).toBe('new text');
  });

  it('can be disabled', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies aria-invalid when aria-invalid is true', () => {
    render(<Textarea aria-invalid="true" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies placeholder text', () => {
    render(<Textarea placeholder="Enter text..." />);
    expect(screen.getByPlaceholderText('Enter text...')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<Textarea className="custom-class" />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('custom-class');
  });

  it('renders with focus-visible ring', () => {
    const { container } = render(<Textarea />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('focus-visible:ring-3');
  });

  it('is accessible via keyboard', () => {
    render(<Textarea />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    expect(textarea).toHaveFocus();
  });
});
