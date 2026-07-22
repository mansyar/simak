import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (active as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();

      if (key === 'r') {
        e.preventDefault();
        queryClient.invalidateQueries();
      } else if (e.key === '?') {
        e.preventDefault();
        setCheatSheetOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [queryClient]);

  return { cheatSheetOpen, setCheatSheetOpen };
}
