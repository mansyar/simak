import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Old Settings Route', () => {
  it('should no longer exist after migration to role-specific routes', () => {
    const oldPath = join(process.cwd(), 'src/routes/_authenticated/settings.tsx');
    expect(existsSync(oldPath)).toBe(false);
  });
});
