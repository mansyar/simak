/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@base-ui/react/dialog', () => {
  const Root = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Backdrop = (props: React.ComponentProps<'div'>) => <div {...props} />;
  const Popup = ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  );
  const Close = ({ children, render, ...props }: any) =>
    render ? React.cloneElement(render, props, children) : <button {...props}>{children}</button>;
  const Title = ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 {...props}>{children}</h2>
  );
  return {
    Dialog: { Root, Trigger: 'button', Portal, Backdrop, Popup, Close, Title, Description: 'p' },
  };
});

describe('dialog and sheet responsive accessibility contracts', () => {
  it('constrains dialog content and provides an accessible close control', () => {
    render(
      <Dialog>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Dialog title</DialogTitle>
          <p>Long content</p>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByTestId('dialog-content');
    expect(content.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(content.className).toContain('overflow-y-auto');
    expect(screen.getByRole('button', { name: 'common.close' })).toBeDefined();
  });

  it('constrains right sheets and uses the correct edge border', () => {
    render(
      <Sheet>
        <SheetContent side="right" data-testid="sheet-content">
          <SheetTitle>Sheet title</SheetTitle>
          <p>Long content</p>
        </SheetContent>
      </Sheet>,
    );

    const content = screen.getByTestId('sheet-content');
    expect(content.className).toContain('max-h-dvh');
    expect(content.className).toContain('overflow-y-auto');
    expect(content.className).toContain('data-[side=right]:border-l');
    expect(content.className).not.toContain('data-[side=right]:border-r');
    expect(screen.getByRole('button', { name: 'common.close' })).toBeDefined();
  });
});
