// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in two-factor.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  disableTwoFactorHandler,
  enableTwoFactorHandler,
  generateTwoFactorSetupHandler,
  getTwoFactorStatusHandler,
  regenerateBackupCodesHandler,
} from './two-factor.server';

// --- Schemas ---

export const EnableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const DisableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const VerifyTwoFactorSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 digits').max(8),
  trustDevice: z.boolean().optional().default(false),
});

export const VerifyBackupCodeSchema = z.object({
  code: z.string().min(1, 'Backup code is required'),
  trustDevice: z.boolean().optional().default(false),
});

export const RegenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const GetTwoFactorStatusSchema = z.object({});

// --- Server function stubs ---

export const generateTwoFactorSetup = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = EnableTwoFactorSchema.parse(args.data);
    return generateTwoFactorSetupHandler({ data });
  });

export const enableTwoFactor = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = VerifyTwoFactorSchema.parse(args.data);
    return enableTwoFactorHandler({ data });
  });

export const disableTwoFactor = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = DisableTwoFactorSchema.parse(args.data);
    return disableTwoFactorHandler({ data });
  });

export const regenerateBackupCodes = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = RegenerateBackupCodesSchema.parse(args.data);
    return regenerateBackupCodesHandler({ data });
  });

export const getTwoFactorStatus = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async (args: { data: unknown }) => {
    const data = GetTwoFactorStatusSchema.parse(args.data);
    return getTwoFactorStatusHandler({ data });
  });
