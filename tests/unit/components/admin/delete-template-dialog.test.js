import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteTemplateDialog } from '@/components/admin/templates/DeleteTemplateDialog';
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) =>
    open ? _jsx('div', { 'data-testid': 'dialog', children: children }) : null,
  DialogContent: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-content', children: children }),
  DialogDescription: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-desc', children: children }),
  DialogFooter: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-footer', children: children }),
  DialogHeader: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-header', children: children }),
  DialogTitle: ({ children }) => _jsx('div', { 'data-testid': 'dialog-title', children: children }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { 'data-testid': 'delete-input', ...props }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }) =>
    _jsx('button', {
      onClick: onClick,
      disabled: disabled,
      'data-testid': 'dialog-btn',
      ...props,
      children: children,
    }),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'adminTemplates.deleteConfirm': 'Delete this template?',
        'adminTemplates.deleteInUse': params
          ? `This template is used by ${params.count} assignment(s). Type DELETE to confirm.`
          : key,
        'adminTemplates.actions.delete': 'Delete',
        'common.cancel': 'Cancel',
      };
      return translations[key] || key;
    },
  }),
}));
describe('DeleteTemplateDialog', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render when open', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    expect(screen.getByTestId('dialog')).toBeDefined();
  });
  it('should not render when closed', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: false,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
  it('should show basic confirm text for unused template', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    const found = screen.getAllByText('Delete this template?');
    expect(found.length).toBeGreaterThan(0);
  });
  it('should show usage warning for in-use template', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 3,
      }),
    );
    expect(screen.getByText(/This template is used by 3/)).toBeDefined();
  });
  it('should show text input for in-use template requiring DELETE', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 3,
      }),
    );
    expect(screen.getByTestId('delete-input')).toBeDefined();
  });
  it('should not show text input for unused template', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    expect(screen.queryByTestId('delete-input')).toBeNull();
  });
  it('should not disable confirm for unused template', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete');
    expect(confirmBtn.disabled).toBe(false);
  });
  it('should disable confirm button for in-use when DELETE not typed', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 3,
      }),
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete');
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.disabled).toBe(true);
  });
  it('should enable confirm button for in-use when DELETE typed', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 3,
      }),
    );
    const input = screen.getByTestId('delete-input');
    fireEvent.change(input, { target: { value: 'DELETE' } });
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete');
    expect(confirmBtn.disabled).toBe(false);
  });
  it('should call onConfirm when delete clicked for unused template', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const confirmBtn = buttons.find((btn) => btn.textContent === 'Delete');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('should call onCancel when cancel clicked', () => {
    render(
      _jsx(DeleteTemplateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: onConfirm,
        usageCount: 0,
      }),
    );
    const buttons = screen.getAllByTestId('dialog-btn');
    const cancelBtn = buttons.find((btn) => btn.textContent === 'Cancel');
    fireEvent.click(cancelBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
