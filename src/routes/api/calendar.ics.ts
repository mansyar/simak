import { createFileRoute } from '@tanstack/react-router';
import { handleCalendarFeedRequest } from '@/server/calendar-feed-route.server';

export const Route = createFileRoute('/api/calendar/ics')({
  server: {
    handlers: {
      GET: ({ request }) => handleCalendarFeedRequest(request),
    },
  },
});
