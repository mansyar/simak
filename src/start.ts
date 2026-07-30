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

const securityHeadersMiddleware = createMiddleware().server(({ next }) => {
  const nonce = generateNonce();
  const r2Domain = getR2Domain();
  const headers = buildSecurityHeaders(nonce, import.meta.env.PROD, r2Domain);

  for (const [name, value] of Object.entries(headers)) {
    setResponseHeader(name, value);
  }

  return next({ context: { nonce } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware(), securityHeadersMiddleware],
}));
