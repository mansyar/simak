import { z } from 'zod';

const baseSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),
  SUPERADMIN_EMAIL: z.string().email('SUPERADMIN_EMAIL must be a valid email'),
  SUPERADMIN_PASSWORD: z.string().min(8, 'SUPERADMIN_PASSWORD must be at least 8 characters'),
});

const r2Schema = z.object({
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid URL'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().url('R2_PUBLIC_URL must be a valid URL'),
});

const envSchema = baseSchema.extend({
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof baseSchema> & Partial<z.infer<typeof r2Schema>>;

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
