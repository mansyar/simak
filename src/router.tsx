import { createRouter } from '@tanstack/react-router';
import { getGlobalStartContext } from '@tanstack/react-start';
import { routeTree } from './routeTree.gen';

// Start background email queue processor and register shutdown handlers on the server only
if (import.meta.env.SSR) {
  import('./lib/email-queue-init').then(({ startEmailQueue }) => {
    startEmailQueue();
  });
  import('./lib/shutdown').then(({ registerShutdownHandlers }) => {
    registerShutdownHandlers();
  });
}

export function getRouter() {
  // nonce is set by securityHeadersMiddleware in src/start.ts at runtime;
  // type assertion needed because getGlobalStartContext() doesn't infer
  // custom middleware context types through the Register interface
  const nonce = (getGlobalStartContext() as { nonce?: string } | undefined)?.nonce;
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: false,
    ssr: { nonce },
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
