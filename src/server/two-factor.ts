// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in two-factor.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

export const generateTwoFactorSetup = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { generateTwoFactorSetupHandler } = await import('./two-factor.server');
    const data = EnableTwoFactorSchema.parse(args.data);
    return generateTwoFactorSetupHandler({ data });
  },
);

export const enableTwoFactor = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { enableTwoFactorHandler } = await import('./two-factor.server');
    const data = VerifyTwoFactorSchema.parse(args.data);
    return enableTwoFactorHandler({ data });
  },
);

export const disableTwoFactor = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { disableTwoFactorHandler } = await import('./two-factor.server');
    const data = DisableTwoFactorSchema.parse(args.data);
    return disableTwoFactorHandler({ data });
  },
);

export const regenerateBackupCodes = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { regenerateBackupCodesHandler } = await import('./two-factor.server');
    const data = RegenerateBackupCodesSchema.parse(args.data);
    return regenerateBackupCodesHandler({ data });
  },
);

export const getTwoFactorStatus = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getTwoFactorStatusHandler } = await import('./two-factor.server');
    const data = GetTwoFactorStatusSchema.parse(args.data);
    return getTwoFactorStatusHandler({ data });
  },
);
