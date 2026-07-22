import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useReviewNav } from '@/hooks/use-review-nav';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/server/reviews', () => ({
  listPendingReviews: vi.fn(),
}));

import { listPendingReviews } from '@/server/reviews';

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useReviewNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should call listPendingReviews on mount with page 1, limit 100', async () => {
    vi.mocked(listPendingReviews).mockResolvedValue({ items: [], total: 0 } as any);

    renderHook(() => useReviewNav(42));

    await waitFor(() => {
      expect(listPendingReviews).toHaveBeenCalledWith({ data: { page: 1, limit: 100 } });
    });
  });

  it('should navigate to next pending review when J is pressed', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }, { submissionId: 3 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 3 } as any);

    const { result } = renderHook(() => useReviewNav(1));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(3);
    });

    act(() => dispatchKey('j'));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/instructor/reviews/$submissionId',
      params: { submissionId: '2' },
    });
  });

  it('should navigate to previous pending review when K is pressed', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }, { submissionId: 3 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 3 } as any);

    const { result } = renderHook(() => useReviewNav(3));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(3);
    });

    act(() => dispatchKey('k'));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/instructor/reviews/$submissionId',
      params: { submissionId: '2' },
    });
  });

  it('should start from index 0 when current submissionId is not in the list', async () => {
    const mockItems = [{ submissionId: 10 }, { submissionId: 20 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const { result } = renderHook(() => useReviewNav(999));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(2);
    });

    act(() => dispatchKey('j'));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/instructor/reviews/$submissionId',
      params: { submissionId: '10' },
    });
  });

  it('should suppress J/K when focus is in an input element', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const { result } = renderHook(() => useReviewNav(1));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(2);
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => dispatchKey('j'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should suppress J/K when focus is in a textarea element', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const { result } = renderHook(() => useReviewNav(1));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(2);
    });

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => dispatchKey('k'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should suppress J/K when focus is in a contenteditable element', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const { result } = renderHook(() => useReviewNav(1));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(2);
    });

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    act(() => dispatchKey('j'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should remove event listener on unmount (no leak)', async () => {
    const mockItems = [{ submissionId: 1 }, { submissionId: 2 }];
    vi.mocked(listPendingReviews).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const { result, unmount } = renderHook(() => useReviewNav(1));

    await waitFor(() => {
      expect(result.current.pendingList.length).toBe(2);
    });

    unmount();

    act(() => dispatchKey('j'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
