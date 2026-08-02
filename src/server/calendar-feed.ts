import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const CalendarFeedLifecycleSchema = z.object({});

export const enableCalendarFeed = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CalendarFeedLifecycleSchema)
  .handler(async ({ data }) => {
    const { enableCalendarFeedHandler } = await import('./calendar-feed.server');
    return enableCalendarFeedHandler({ data });
  });

export const getCalendarFeedStatus = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    const { getCalendarFeedStatusHandler } = await import('./calendar-feed.server');
    return getCalendarFeedStatusHandler();
  });

export const regenerateCalendarFeed = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CalendarFeedLifecycleSchema)
  .handler(async ({ data }) => {
    const { regenerateCalendarFeedHandler } = await import('./calendar-feed.server');
    return regenerateCalendarFeedHandler({ data });
  });

export const revokeCalendarFeed = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CalendarFeedLifecycleSchema)
  .handler(async ({ data }) => {
    const { revokeCalendarFeedHandler } = await import('./calendar-feed.server');
    return revokeCalendarFeedHandler({ data });
  });
