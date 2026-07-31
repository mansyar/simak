/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { generateNonce, buildSecurityHeaders } from '@/lib/security-headers';

describe('generateNonce', () => {
  it('returns a base64 string of 24 characters (16 bytes encoded)', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(24);
    // base64 alphabet: A-Z, a-z, 0-9, +, /, =
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('returns unique values across multiple calls', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    expect(nonces.size).toBe(100);
  });
});

describe('buildSecurityHeaders', () => {
  const testNonce = 'dGVzdE5vbmNlMTIzNDU2Nzg=';
  const testR2Domain = 'r2-cloudflare.example.com';

  describe('CSP header key switching', () => {
    it('uses Content-Security-Policy key in prod', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
    });

    it('uses Content-Security-Policy-Report-Only key in dev', () => {
      const headers = buildSecurityHeaders(testNonce, false, testR2Domain);
      expect(headers).toHaveProperty('Content-Security-Policy-Report-Only');
      expect(headers).not.toHaveProperty('Content-Security-Policy');
    });
  });

  describe('CSP directives', () => {
    function getCsp(isProd: boolean, r2Domain?: string): string {
      const headers = buildSecurityHeaders(testNonce, isProd, r2Domain);
      return (
        headers['Content-Security-Policy'] ?? headers['Content-Security-Policy-Report-Only'] ?? ''
      );
    }

    it('includes default-src self', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("default-src 'self'");
    });

    it('includes script-src with nonce and strict-dynamic', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain(`script-src 'nonce-${testNonce}' 'strict-dynamic'`);
    });

    it('includes style-src with nonce', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain(`style-src 'nonce-${testNonce}'`);
    });

    it('allows Sonner’s static runtime stylesheet by hash', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='");
    });

    it('allows inline style attributes without weakening nonce-protected style elements', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("style-src-attr 'unsafe-inline'");
    });

    it('includes img-src self data https', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("img-src 'self' data: https:");
    });

    it('includes frame-src self', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("frame-src 'self'");
    });

    it('includes frame-ancestors none', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('includes base-uri self', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("base-uri 'self'");
    });

    it('includes form-action self', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain("form-action 'self'");
    });

    it('allows only the R2 endpoint and bucket subdomains for object-src', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain(`object-src https://${testR2Domain} https://*.${testR2Domain}`);
    });

    it('includes upgrade-insecure-requests in prod', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('omits upgrade-insecure-requests in dev (Report-Only mode)', () => {
      const csp = getCsp(false, testR2Domain);
      expect(csp).not.toContain('upgrade-insecure-requests');
    });

    it('includes the R2 endpoint and bucket subdomains in connect-src', () => {
      const csp = getCsp(true, testR2Domain);
      expect(csp).toContain(`connect-src 'self' https://${testR2Domain} https://*.${testR2Domain}`);
    });

    it('includes connect-src with only self when R2 domain is omitted', () => {
      const csp = getCsp(true);
      expect(csp).toContain("connect-src 'self'");
      expect(csp).not.toContain(testR2Domain);
      expect(csp).toContain("object-src 'none'");
    });

    it('includes connect-src with only self when R2 domain is undefined', () => {
      const csp = getCsp(true, undefined);
      expect(csp).toContain("connect-src 'self'");
    });
  });

  describe('additional security headers', () => {
    it('includes X-Frame-Options DENY', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('includes X-Content-Type-Options nosniff', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('includes Referrer-Policy strict-origin-when-cross-origin', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('includes Permissions-Policy with geolocation, microphone, camera disabled', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers['Permissions-Policy']).toBe('geolocation=(), microphone=(), camera=()');
    });
  });

  describe('HSTS (Strict-Transport-Security)', () => {
    it('includes HSTS in prod', () => {
      const headers = buildSecurityHeaders(testNonce, true, testR2Domain);
      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    });

    it('omits HSTS in dev', () => {
      const headers = buildSecurityHeaders(testNonce, false, testR2Domain);
      expect(headers).not.toHaveProperty('Strict-Transport-Security');
    });
  });
});
