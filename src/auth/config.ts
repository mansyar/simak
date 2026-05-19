import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { getDb } from '../db/index';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: 'users',
      session: 'session',
      account: 'account',
      verification: 'verification',
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  additionalFields: {
    role: {
      type: 'string',
      required: true,
      input: false,
    },
    locale: {
      type: 'string',
      required: false,
      defaultValue: 'en',
    },
  },
  plugins: [tanstackStartCookies()],
});
