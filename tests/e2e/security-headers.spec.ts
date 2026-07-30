import { test, expect } from '@playwright/test';

/**
 * E2E tests for HTTP security headers.
 *
 * Verifies that all security headers (CSP, X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy, Permissions-Policy, and HSTS) are present on responses.
 *
 * The dev server runs with import.meta.env.PROD = false, so:
 * - CSP header name is "Content-Security-Policy-Report-Only" (not enforced)
 * - HSTS (Strict-Transport-Security) is NOT present
 *
 * NOTE: Routes with beforeLoad hooks calling getSessionFromHeaders() (e.g., /auth/login,
 * /admin/dashboard) currently return 500 during SSR due to a pre-existing TanStack Start
 * server-function interception issue (server function called in "client" mode during SSR).
 * This is NOT caused by the security headers implementation. Security headers are only
 * merged into the final HTTP response for 2xx responses (h3-v2 behavior). Once the
 * pre-existing SSR issue is fixed, authenticated route tests can be added here.
 */
test.describe('Security Headers', () => {
  test.describe.configure({ mode: 'serial' });

  test('all security headers present on landing page', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    const headers = response!.headers();

    // CSP (Report-Only in dev)
    const csp = headers['content-security-policy-report-only'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("style-src 'nonce-");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
    // upgrade-insecure-requests is only included in prod (enforced CSP).
    // In dev (Report-Only), it has no effect and Chrome logs a console error.

    // Additional security headers
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');

    // HSTS should NOT be present in dev
    expect(headers['strict-transport-security']).toBeUndefined();
  });

  test('each request gets a unique nonce', async ({ request }) => {
    const response1 = await request.get('/');
    const csp1 = response1.headers()['content-security-policy-report-only'];

    const response2 = await request.get('/');
    const csp2 = response2.headers()['content-security-policy-report-only'];

    const nonce1 = csp1?.match(/nonce-([a-zA-Z0-9+/=]+)/)?.[1];
    const nonce2 = csp2?.match(/nonce-([a-zA-Z0-9+/=]+)/)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });
});
