import { createFileRoute } from '@tanstack/react-router';
import { runHealthChecks } from '@/server/health.server';

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const body = await runHealthChecks();
        return new Response(JSON.stringify(body), {
          status: body.status === 'healthy' ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
