import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/server/settings';
import { settingsKeys } from '@/lib/query-keys';
import { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from '@/lib/timezone';

type StudentSettingsResponse = {
  settings: {
    timezone?: string;
  } | null;
};

type StudentTimezoneContextValue = {
  timezone: string;
  hydrated: boolean;
};

const defaultValue: StudentTimezoneContextValue = {
  timezone: DEFAULT_TIME_ZONE,
  hydrated: true,
};

const StudentTimezoneContext = createContext<StudentTimezoneContextValue>(defaultValue);

export function StudentTimezoneProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: settingsKeys.currentUser(),
    queryFn: async () => (await getCurrentUser()) as StudentSettingsResponse,
  });
  const [detectedTimezone, setDetectedTimezone] = useState<string>();
  const [hydrated, setHydrated] = useState(false);

  const savedTimezone = isValidTimeZone(data?.settings?.timezone)
    ? data?.settings?.timezone
    : undefined;

  useEffect(() => {
    if (isLoading) return;

    if (savedTimezone) {
      setDetectedTimezone(savedTimezone);
      setHydrated(true);
      return;
    }

    let browserTimezone: string | undefined;
    try {
      browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      browserTimezone = undefined;
    }

    setDetectedTimezone(resolveTimeZone(undefined, browserTimezone));
    setHydrated(true);
  }, [data, isLoading, savedTimezone]);

  const value = useMemo(
    () => ({
      timezone: savedTimezone ?? detectedTimezone ?? DEFAULT_TIME_ZONE,
      hydrated,
    }),
    [detectedTimezone, hydrated, savedTimezone],
  );

  return createElement(StudentTimezoneContext.Provider, { value }, children);
}

export function useStudentTimezone(): StudentTimezoneContextValue {
  return useContext(StudentTimezoneContext);
}
