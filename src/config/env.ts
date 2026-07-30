import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),
  SUPERADMIN_EMAIL: z.string().email('SUPERADMIN_EMAIL must be a valid email'),
  SUPERADMIN_PASSWORD: z.string().min(8, 'SUPERADMIN_PASSWORD must be at least 8 characters'),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  MIGRATE_DATABASE_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM cannot be empty').default('SIMAK <noreply@simak.app>'),
  LOG_LEVEL: z.string().default('info'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_PREPARED_STATEMENTS_DISABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `  - ${String(issue.path ?? '')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Environment variable validation failed:\n${errorMessages}\n\n` +
        `Please ensure all required environment variables are set in your .env file.`,
    );
  }

  _env = result.data;
  return _env;
}
