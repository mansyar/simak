import { useRef, useCallback, useEffect } from 'react';

type CancelableDebouncedCallback = {
  cancel: () => void;
};

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
): T & CancelableDebouncedCallback {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    },
    [cancel, delay],
    // Cast needed: useCallback returns (...args) => void, but T may have a specific return type.
    // The debounced wrapper intentionally returns void; callers use it for side effects only.
  );

  return Object.assign(debouncedCallback, { cancel }) as T & CancelableDebouncedCallback;
}
