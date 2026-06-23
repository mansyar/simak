import { describe, expect, it } from 'vitest';
import { read, utils, write } from 'xlsx';

/**
 * Helper: build a .xlsx Buffer from a 2D string array (headers + rows).
 */
function buildXlsx(rows: string[][]): Buffer {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/**
 * Placeholder parser — will be implemented in src/lib/bulk-import/parse-users.ts.
 * Tests import it once the module exists.
 */
async function parseUsersXlsx(
  file: File,
  actorRole: string,
): Promise<{
  rows: Array<{
    name: string;
    email: string;
    role: string;
    status: 'valid' | 'invalid';
    error?: string;
  }>;
  errors: string[];
}> {
  // Dynamic import to be replaced once the module is created
  const mod = await import('@/lib/bulk-import/parse-users');
  return mod.parseUsersXlsx(file, actorRole);
}

function fileFromBuffer(buf: Buffer, name = 'users.xlsx'): File {
  return new File([new Uint8Array(buf)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseUsersXlsx', () => {
  describe('Header validation', () => {
    it('should accept exact headers: name, email, role', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'alice@test.com', 'admin'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'superadmin');
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe('valid');
    });

    it('should reject missing required header', async () => {
      const buf = buildXlsx([
        ['name', 'email'],
        ['Alice', 'alice@test.com'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'superadmin');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject unknown header column', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role', 'department'],
        ['Alice', 'alice@test.com', 'student', 'CS'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'superadmin');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Whitespace trimming', () => {
    it('should trim whitespace from name, email, and role', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['  Alice  ', '  alice@test.com  ', '  student  '],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].name).toBe('Alice');
      expect(result.rows[0].email).toBe('alice@test.com');
      expect(result.rows[0].role).toBe('student');
    });
  });

  describe('Lowercasing', () => {
    it('should lowercase email and role', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'Alice@Test.COM', 'STUDENT'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].email).toBe('alice@test.com');
      expect(result.rows[0].role).toBe('student');
    });
  });

  describe('Per-row validation', () => {
    it('should mark row as invalid if name is empty', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['', 'alice@test.com', 'student'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].status).toBe('invalid');
      expect(result.rows[0].error).toBeDefined();
    });

    it('should mark row as invalid if email format is wrong', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'not-an-email', 'student'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].status).toBe('invalid');
      expect(result.rows[0].error).toBeDefined();
    });

    it('should mark row as invalid if role is not creatable by actor', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'alice@test.com', 'admin'],
      ]);
      const file = fileFromBuffer(buf);
      // Admins cannot create admin users
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].status).toBe('invalid');
      expect(result.rows[0].error).toBeDefined();
    });

    it('should mark superadmin role as invalid for any actor', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'alice@test.com', 'superadmin'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].status).toBe('invalid');
      expect(result.rows[0].error).toBeDefined();
    });

    it('should validate multiple rows independently', async () => {
      const buf = buildXlsx([
        ['name', 'email', 'role'],
        ['Alice', 'alice@test.com', 'student'],
        ['', 'bob@test.com', 'student'],
        ['Charlie', 'charlie@test.com', 'instructor'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.rows[0].status).toBe('valid');
      expect(result.rows[1].status).toBe('invalid');
      expect(result.rows[2].status).toBe('valid');
    });
  });

  describe('Row-limit enforcement', () => {
    it('should reject files exceeding 500 rows', async () => {
      const rows: string[][] = [['name', 'email', 'role']];
      for (let i = 0; i < 501; i++) {
        rows.push([`User${i}`, `user${i}@test.com`, 'student']);
      }
      const buf = buildXlsx(rows);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept files with exactly 500 rows', async () => {
      const rows: string[][] = [['name', 'email', 'role']];
      for (let i = 0; i < 500; i++) {
        rows.push([`User${i}`, `user${i}@test.com`, 'student']);
      }
      const buf = buildXlsx(rows);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(500);
    });
  });

  describe('Empty-sheet handling', () => {
    it('should handle sheet with only headers (no data rows)', async () => {
      const buf = buildXlsx([['name', 'email', 'role']]);
      const file = fileFromBuffer(buf);
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(0);
    });

    it('should handle completely empty sheet', async () => {
      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet([]);
      utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = write(wb, { type: 'buffer', bookType: 'xlsx' });
      const file = fileFromBuffer(Buffer.from(buf));
      const result = await parseUsersXlsx(file, 'admin');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
