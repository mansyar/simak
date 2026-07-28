import { createServerFn } from '@tanstack/react-start';
import type { z } from 'zod';

/**
 * A callable server function stub with proper return-type inference.
 *
 * Replaces the `Fetcher<..., unknown>` return type that `createServerFn`
 * produces (due to the `ValidateSerializableInput` conditional type preventing
 * inference of `TNewResponse`).
 */
export type TypedFetcher<TInput, TResponse> = (args: { data: TInput }) => Promise<TResponse>;

/**
 * Fetcher for handler-only server fns (no `inputValidator`).
 * Callable with 0 arguments — mirrors TanStack's `OptionalFetcher`.
 */
export type OptionalFetcher<TResponse> = (args?: { data?: unknown }) => Promise<TResponse>;

interface TypedBuilderWithValidator<TInput, TOutput> {
  handler<TResponse>(
    fn: (ctx: { data: TOutput }) => Promise<TResponse> | TResponse,
  ): TypedFetcher<TInput, TResponse>;
}

interface TypedBuilder {
  inputValidator<TSchema extends z.ZodType>(
    schema: TSchema,
  ): TypedBuilderWithValidator<z.input<TSchema>, z.output<TSchema>>;
  handler<TResponse>(
    fn: (ctx: { data: unknown }) => Promise<TResponse> | TResponse,
  ): OptionalFetcher<TResponse>;
}

/**
 * Wraps `createServerFn` with proper generic return-type inference.
 *
 * At runtime this is a pure pass-through — the single `as unknown as` cast is
 * type-only and has no behavioural effect. The wrapper exists because
 * `createServerFn`'s `handler` method loses the return type through the
 * `ServerFnReturnType` conditional type (which applies `ValidateSerializableInput`),
 * causing `TNewResponse` to default to `unknown`.
 *
 * Usage (typed-builder pattern):
 * ```ts
 * export const myFn = typedServerFn({ method: 'GET' })
 *   .inputValidator(Schema)
 *   .handler(async ({ data }) => ({ result: data.field }));
 * ```
 *
 * Usage (inline-parse pattern):
 * ```ts
 * export const myFn = typedServerFn({ method: 'GET' })
 *   .handler(async (args) => { const data = Schema.parse(args.data); ... });
 * ```
 */
export function typedServerFn(opts: { method: 'GET' | 'POST' }): TypedBuilder {
  return createServerFn(opts) as unknown as TypedBuilder;
}
