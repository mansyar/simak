import { createStart, createMiddleware, createCsrfMiddleware } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';

import { generateNonce, buildSecurityHeaders } from '@/lib/security-headers';

export function getR2Domain(): string | undefined {
  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) return undefined;
  try {
    return new URL(endpoint).hostname;
  } catch {
    return undefined;
  }
}

const securityHeadersMiddleware = createMiddleware().server(({ request, next }) => {
  const nonce = generateNonce();
  const r2Domain = getR2Domain();
  const headers = buildSecurityHeaders(nonce, import.meta.env.PROD, r2Domain);

  if (new URL(request.url).pathname === '/api/calendar/ics') {
    headers['Referrer-Policy'] = 'no-referrer';
  }

  for (const [name, value] of Object.entries(headers)) {
    setResponseHeader(name, value);
  }

  return next({ context: { nonce } });
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}));
