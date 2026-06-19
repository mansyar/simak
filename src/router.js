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
    });
    return router;
}
