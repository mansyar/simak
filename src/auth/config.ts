import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { getDb } from '../db/index';
import { sendPasswordResetEmail } from '../lib/email';

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
    sendResetPassword: async ({ user, url }) => {
      // Extract token from the Better-Auth generated URL
      const token = new URL(url).searchParams.get('token') ?? '';
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        token,
      });
    },
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
