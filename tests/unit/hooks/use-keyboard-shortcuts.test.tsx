import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should call queryClient.invalidateQueries when R is pressed', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper(queryClient) });

    act(() => dispatchKey('r'));

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should call queryClient.invalidateQueries when Shift+R is pressed', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper(queryClient) });

    act(() => dispatchKey('R'));

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should toggle cheat-sheet open state when ? is pressed', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    expect(result.current.cheatSheetOpen).toBe(false);

    act(() => dispatchKey('?'));

    expect(result.current.cheatSheetOpen).toBe(true);

    act(() => dispatchKey('?'));

    expect(result.current.cheatSheetOpen).toBe(false);
  });

  it('should suppress shortcuts when focus is in an <input> element', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper(queryClient) });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => dispatchKey('r'));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should suppress shortcuts when focus is in a <textarea> element', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper(queryClient) });

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => dispatchKey('r'));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should suppress shortcuts when focus is in a [contenteditable] element', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper(queryClient) });

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    act(() => dispatchKey('r'));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should remove event listener on unmount (no leak)', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(() => useKeyboardShortcuts(), {
      wrapper: createWrapper(queryClient),
    });

    unmount();

    act(() => dispatchKey('r'));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
