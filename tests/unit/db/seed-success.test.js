import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock database implementation
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockSelect = vi
  .fn()
  .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });
vi.mock('@/db/index', () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
  })),
}));
vi.mock('better-auth/crypto', () => ({
  hashPassword: vi.fn((pw) => Promise.resolve(`hashed_${pw}`)),
}));
describe('Seed script - success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPERADMIN_EMAIL', 'admin@test.com');
    vi.stubEnv('SUPERADMIN_PASSWORD', 'strong-password-123');
  });
  it('should create user and account when no existing user found', async () => {
    const { seedSuperAdmin } = await import('@/db/seed');
    await seedSuperAdmin();
    // Should check for existing user
    expect(mockSelect).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(2);
    // First insert should be the user
    const firstInsertCall = mockInsert.mock.calls[0][0];
    expect(firstInsertCall).toBeDefined();
  });
  it('should skip when user already exists', async () => {
    // Mock select to return an existing user
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'existing-id', email: 'admin@test.com' }]),
      }),
    });
    const { seedSuperAdmin } = await import('@/db/seed');
    await seedSuperAdmin();
    // Should NOT insert anything if user exists
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it('should validate email format', async () => {
    vi.stubEnv('SUPERADMIN_EMAIL', 'not-an-email');
    vi.stubEnv('SUPERADMIN_PASSWORD', 'strong-password-123');
    const { seedSuperAdmin } = await import('@/db/seed');
    await expect(seedSuperAdmin()).rejects.toThrow(/invalid.*email/i);
  });
  it('should validate password minimum length', async () => {
    vi.stubEnv('SUPERADMIN_EMAIL', 'admin@test.com');
    vi.stubEnv('SUPERADMIN_PASSWORD', 'short');
    const { seedSuperAdmin } = await import('@/db/seed');
    await expect(seedSuperAdmin()).rejects.toThrow(/password.*8/i);
  });
  it('seedTestUsers should create instructor and student when no existing', async () => {
    // Reset mock implementation to return empty array (no existing users)
    mockSelect.mockReset();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockInsert.mockReset();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const { seedTestUsers } = await import('@/db/seed');
    await seedTestUsers();
    // Should check for existing users
    expect(mockSelect).toHaveBeenCalled();
    // Should insert 4 times (2 users + 2 accounts)
    expect(mockInsert).toHaveBeenCalledTimes(4);
  });
  it('should export seedSuperAdmin and seedTestUsers as functions', async () => {
    const seedModule = await import('@/db/seed');
    expect(typeof seedModule.seedSuperAdmin).toBe('function');
    expect(typeof seedModule.seedTestUsers).toBe('function');
  });
  it('should trigger seed functions when run as main module', async () => {
    // Simulate being the main module
    const origArgv = process.argv;
    vi.stubGlobal('process', {
      ...process,
      argv: ['node', '/path/to/seed.ts'],
      exit: vi.fn(),
    });
    // Re-import to trigger the isMainModule check
    await import('@/db/seed');
  });
  it('seedTestUsers should skip when users already exist', async () => {
    // Reset and mock select to return existing users
    mockSelect.mockReset();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'existing-id', email: 'existing@test.com' }]),
      }),
    });
    mockInsert.mockReset();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const { seedTestUsers } = await import('@/db/seed');
    await seedTestUsers();
    // Should NOT insert anything if users already exist
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
