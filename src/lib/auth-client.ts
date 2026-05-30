import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/auth/verify-2fa';
      },
    }),
  ],
});
