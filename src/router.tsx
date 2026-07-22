import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Start background email queue processor on the server only
if (import.meta.env.SSR) {
  import('./lib/email-queue-init').then(({ startEmailQueue }) => {
    startEmailQueue();
  });
}

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: false,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
