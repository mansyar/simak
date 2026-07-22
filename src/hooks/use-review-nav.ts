import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { listPendingReviews } from '@/server/reviews';
import { isServerError } from '@/lib/errors';

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (active as HTMLElement).isContentEditable;
}

interface PendingReviewItem {
  submissionId: number;
}

export function useReviewNav(submissionId: number) {
  const navigate = useNavigate();
  const [pendingList, setPendingList] = useState<PendingReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listPendingReviews({ data: { page: 1, limit: 100 } });
        if (cancelled || isServerError(result)) return;
        setPendingList(result.items);
        const idx = result.items.findIndex((item) => item.submissionId === submissionId);
        setCurrentIndex(idx);
      } catch {
        // Silently fail — J/K will just not work
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (pendingList.length === 0) return;

      const key = e.key.toLowerCase();

      if (key === 'j') {
        e.preventDefault();
        const nextIdx = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, pendingList.length - 1);
        navigate({
          to: '/instructor/reviews/$submissionId',
          params: { submissionId: String(pendingList[nextIdx].submissionId) },
        });
      } else if (key === 'k') {
        e.preventDefault();
        const prevIdx = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
        navigate({
          to: '/instructor/reviews/$submissionId',
          params: { submissionId: String(pendingList[prevIdx].submissionId) },
        });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingList, currentIndex, navigate]);

  return { pendingList, currentIndex };
}
