import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { twoFactor } from 'better-auth/plugins';
import { getDb } from '../db/index';
import { sendPasswordResetEmail } from '../lib/email';
import * as schema from '../db/schema/index';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
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
  plugins: [
    tanstackStartCookies(),
    twoFactor({
      issuer: 'SIMAK',
    }),
  ],
});
