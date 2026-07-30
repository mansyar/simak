/** @vitest-environment node */
import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import { getRequestId, requestContextStorage } from '@/lib/request-context-store';

describe('request-context-store', () => {
  it('exports an AsyncLocalStorage instance', () => {
    expect(requestContextStorage).toBeInstanceOf(AsyncLocalStorage);
  });

  it('returns undefined outside a store context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('returns the request ID inside a store context', () => {
    requestContextStorage.run({ requestId: 'test-id' }, () => {
      expect(getRequestId()).toBe('test-id');
    });
  });

  it('scopes the request ID to the run callback', () => {
    requestContextStorage.run({ requestId: 'test-id' }, () => {
      expect(getRequestId()).toBe('test-id');
    });

    expect(getRequestId()).toBeUndefined();
  });

  it('restores the parent store after nested runs', () => {
    requestContextStorage.run({ requestId: 'parent-id' }, () => {
      requestContextStorage.run({ requestId: 'child-id' }, () => {
        expect(getRequestId()).toBe('child-id');
      });

      expect(getRequestId()).toBe('parent-id');
    });
  });
});
