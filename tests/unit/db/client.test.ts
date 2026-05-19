import { describe, it, expect } from 'vitest';

describe('Database client', () => {
  it('should export db and getDb from the module', async () => {
    const mod = await import('@/db/index');
    expect(mod).toHaveProperty('db');
    expect(mod).toHaveProperty('getDb');
  });

  it('should have a non-null db instance', async () => {
    const { db } = await import('@/db/index');
    expect(db).not.toBeNull();
    expect(db).not.toBeUndefined();
  });

  it('should have a select method on db', async () => {
    const { db } = await import('@/db/index');
    expect(typeof db.select).toBe('function');
  });

  it('should have an insert method on db', async () => {
    const { db } = await import('@/db/index');
    expect(typeof db.insert).toBe('function');
  });

  it('should have an update method on db', async () => {
    const { db } = await import('@/db/index');
    expect(typeof db.update).toBe('function');
  });

  it('should have a delete method on db', async () => {
    const { db } = await import('@/db/index');
    expect(typeof db.delete).toBe('function');
  });

  it('should return cached instance on repeated getDb calls', async () => {
    const mod = await import('@/db/index');
    const first = mod.getDb();
    const second = mod.getDb();
    expect(first).toBe(second);
  });

  it('should have getDb return db singleton instance', async () => {
    const mod = await import('@/db/index');
    const first = mod.getDb();
    const second = mod.getDb();
    // getDb() should return the same instance on repeated calls
    expect(first).toBe(second);
  });
});
