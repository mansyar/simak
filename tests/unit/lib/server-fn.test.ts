/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, expectTypeOf } from 'vitest';
import { z } from 'zod';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import { createServerFn } from '@tanstack/react-start';
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
