import { useState, useCallback } from 'react';

export function useRefreshSearch() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (onRefresh: () => void | Promise<void>) => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  }, []);

  return { isRefreshing, refresh };
}
