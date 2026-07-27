/**
 * Type-level test: demonstrates that `createServerFn` does not propagate
 * the handler's return type to the callable stub.
 *
 * Root cause: `createServerFn`'s `handler` method has generic `<TNewResponse>`,
 * but the `ServerFnReturnType` conditional type (which applies
 * `ValidateSerializableInput`) prevents TypeScript from inferring `TNewResponse`.
 * It defaults to `unknown`, making the `Fetcher` return type `Promise<unknown>`.
 *
 * Before the `typedServerFn` fix: Tests 1-2 FAIL (type error) because
 * the return type is `unknown`. Test 3 PASSES because input type IS inferred.
 * After the fix: All tests PASS because the return type is properly inferred.
 */

import { expectTypeOf } from 'vitest';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// --- Test fixtures ---

const TestSchema = z.object({
  name: z.string(),
});

// Pattern 1: Typed builder (inputValidator + handler) — used by assignments.ts
const typedBuilderFn = createServerFn({ method: 'GET' })
  .inputValidator(TestSchema)
  .handler(async ({ data }) => {
    return { count: 1, name: data.name };
  });

// Pattern 2: Inline parse (handler with unknown data) — used by notifications.ts
const inlineParseFn = createServerFn({ method: 'GET' }).handler(async (args: { data: unknown }) => {
  const data = TestSchema.parse(args.data);
  return { count: 1, name: data.name };
});

// --- Type-level assertions ---

// Test 1: Typed-builder pattern — resolved return type should be { count: number; name: string }
expectTypeOf(typedBuilderFn).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();

// Test 2: Inline-parse pattern — resolved return type should be { count: number; name: string }
expectTypeOf(inlineParseFn).returns.resolves.toEqualTypeOf<{ count: number; name: string }>();

// Test 3: Typed-builder input parameter type — data should include { name: string }
// (This PASSES even before the fix — input types ARE properly inferred)
expectTypeOf(typedBuilderFn).parameter(0).toMatchTypeOf<{ data: { name: string } }>();
