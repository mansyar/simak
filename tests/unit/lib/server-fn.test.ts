/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, expectTypeOf } from 'vitest';
import { z } from 'zod';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { createServerFn } from '@tanstack/react-start';
import { requestIdMiddleware } from '@/lib/request-context';
import { typedServerFn } from '@/lib/server-fn';

describe('typedServerFn — runtime behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to createServerFn with the provided options', () => {
    typedServerFn({ method: 'GET' });

    expect(createServerFn).toHaveBeenCalledWith({ method: 'GET' });
  });

  it('preserves the .inputValidator(Schema).handler(fn) builder chain (typed-builder pattern)', () => {
    const schema = z.object({ name: z.string() });
    const handler = async ({ data }: { data: { name: string } }) => ({ result: data.name });

    const stub = typedServerFn({ method: 'POST' }).inputValidator(schema).handler(handler);

    expect(stub).toBeDefined();
    expect(typeof stub).toBe('function');
  });

  it('preserves the .handler(fn) builder chain (inline-parse pattern)', () => {
    const handler = async (args: { data: unknown }) => {
      const data = z.object({ name: z.string() }).parse(args.data);
      return { result: data.name };
    };

    const stub = typedServerFn({ method: 'GET' }).handler(handler);

    expect(stub).toBeDefined();
    expect(typeof stub).toBe('function');
  });

  it('returns the handler function from the builder chain at runtime', () => {
    const schema = z.object({ name: z.string() });
    const handler = async ({ data }: { data: { name: string } }) => ({ result: data.name });

    const stub = typedServerFn({ method: 'POST' }).inputValidator(schema).handler(handler);

    // The mock's handler implementation returns the fn itself
    expect(stub).toBe(handler);
  });
});

describe('typedServerFn — type-level behavior', () => {
  it('propagates the handler return type to the callable stub (typed-builder pattern)', () => {
    const schema = z.object({ name: z.string() });
    const stub = typedServerFn({ method: 'GET' })
      .inputValidator(schema)
      .handler(async ({ data }) => ({ count: 1, name: data.name }));

    expectTypeOf(stub).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();
  });

  it('propagates the handler return type to the callable stub (inline-parse pattern)', () => {
    const stub = typedServerFn({ method: 'GET' }).handler(async (args: { data: unknown }) => {
      const data = z.object({ name: z.string() }).parse(args.data);
      return { count: 1, name: data.name };
    });

    expectTypeOf(stub).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();
  });

  it('infers the input type from the Zod schema (typed-builder pattern)', () => {
    const schema = z.object({ name: z.string() });
    const stub = typedServerFn({ method: 'POST' })
      .inputValidator(schema)
      .handler(async ({ data }) => ({ result: data.name }));

    expectTypeOf(stub).parameter(0).toEqualTypeOf<{ data: { name: string } }>();
  });
});

describe('typedServerFn — rateLimit config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls .middleware([...]) when rateLimit is provided', () => {
    typedServerFn({ method: 'GET', rateLimit: { window: 60, max: 5 } });

    const builder = createServerFn();
    expect(builder.middleware).toHaveBeenCalledWith(
      expect.arrayContaining([requestIdMiddleware, expect.any(Function)]),
    );
  });

  it('calls .middleware([requestIdMiddleware]) when rateLimit is omitted', () => {
    typedServerFn({ method: 'GET' });

    const builder = createServerFn();
    expect(builder.middleware).toHaveBeenCalledWith([requestIdMiddleware]);
  });

  it('preserves the .inputValidator(Schema).handler(fn) chain when rateLimit is provided', () => {
    const schema = z.object({ name: z.string() });
    const handler = async ({ data }: { data: { name: string } }) => ({ result: data.name });

    const stub = typedServerFn({ method: 'POST', rateLimit: { window: 60, max: 10 } })
      .inputValidator(schema)
      .handler(handler);

    expect(stub).toBeDefined();
    expect(typeof stub).toBe('function');
  });

  it('existing typed-builder pattern still works without rateLimit (regression)', () => {
    const schema = z.object({ name: z.string() });
    const handler = async ({ data }: { data: { name: string } }) => ({ result: data.name });

    const stub = typedServerFn({ method: 'POST' }).inputValidator(schema).handler(handler);

    expect(stub).toBeDefined();
    expect(typeof stub).toBe('function');
  });

  it('existing inline-parse pattern still works without rateLimit (regression)', () => {
    const handler = async (args: { data: unknown }) => {
      const data = z.object({ name: z.string() }).parse(args.data);
      return { result: data.name };
    };

    const stub = typedServerFn({ method: 'GET' }).handler(handler);

    expect(stub).toBeDefined();
    expect(typeof stub).toBe('function');
  });
});
