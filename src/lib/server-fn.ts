import { createServerFn } from '@tanstack/react-start';
import type { z } from 'zod';
import { createRateLimitMiddleware, type RateLimitConfig } from '@/lib/rate-limiter';
import { requestIdMiddleware } from '@/lib/request-context';

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
  middleware(middlewares: unknown[]): TypedBuilder;
  inputValidator<TSchema extends z.ZodType>(
    schema: TSchema,
  ): TypedBuilderWithValidator<z.input<TSchema>, z.output<TSchema>>;
  handler<TResponse>(
    fn: (ctx: { data: unknown }) => Promise<TResponse> | TResponse,
  ): OptionalFetcher<TResponse>;
}

type TypedServerFn = (opts?: { method?: 'GET' | 'POST' }) => TypedBuilder;

/**
 * A type-preserving alias for `createServerFn`.
 *
 * The cast is type-only and has no behavioural effect. A value alias lets the
 * Start compiler resolve this to `createServerFn`, while retaining the return
 * type inference lost by the upstream builder.
 */
export const typedServerFn = createServerFn as unknown as TypedServerFn;

/**
 * Builds the standard middleware chain for every server function.
 *
 * The custom builder previously applied this chain internally. Keeping it
 * explicit at call sites preserves the same request-ID and rate-limit order.
 */
export function serverFnMiddlewares(rateLimit?: RateLimitConfig): unknown[] {
  const middlewares: unknown[] = [requestIdMiddleware];

  if (rateLimit) {
    middlewares.push(createRateLimitMiddleware(rateLimit));
  }

  return middlewares;
}
