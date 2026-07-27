/**
 * Type-level test: verifies that `typedServerFn` properly propagates
 * the handler's return type to the callable stub.
 *
 * Background: `createServerFn` does not propagate the return type — its
 * `handler` method has generic `<TNewResponse>`, but `ServerFnReturnType`
 * applies `ValidateSerializableInput` (a recursive conditional type) that
 * prevents TypeScript from inferring `TNewResponse`. It defaults to `unknown`,
 * making the `Fetcher` return type `Promise<unknown>`.
 *
 * The `typedServerFn` wrapper fixes this by providing explicit return-type
 * inference via the `TypedFetcher` type. All three tests below PASS with
 * `typedServerFn`, confirming the fix works for both server-fn patterns.
 */

import { expectTypeOf } from 'vitest';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

// --- Test fixtures ---

const TestSchema = z.object({
  name: z.string(),
});

// Pattern 1: Typed builder (inputValidator + handler) — used by assignments.ts
const typedBuilderFn = typedServerFn({ method: 'GET' })
  .inputValidator(TestSchema)
  .handler(async ({ data }) => {
    return { count: 1, name: data.name };
  });

// Pattern 2: Inline parse (handler with unknown data) — used by notifications.ts
const inlineParseFn = typedServerFn({ method: 'GET' }).handler(async (args: { data: unknown }) => {
  const data = TestSchema.parse(args.data);
  return { count: 1, name: data.name };
});

// --- Type-level assertions ---

// Test 1: Typed-builder pattern — resolved return type should be { count: number; name: string }
expectTypeOf(typedBuilderFn).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();

// Test 2: Inline-parse pattern — resolved return type should be { count: number; name: string }
expectTypeOf(inlineParseFn).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();

// Test 3: Typed-builder input parameter type — data should include { name: string }
expectTypeOf(typedBuilderFn).parameter(0).toMatchTypeOf<{ data: { name: string } }>();
