import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';

/**
 * Placeholder generators — will be implemented in src/lib/bulk-import/samples.ts.
 */
async function generateUserSampleXlsx(): Promise<Blob> {
  const mod = await import('@/lib/bulk-import/samples');
  return mod.generateUserSampleXlsx();
}

async function generateTemplateSampleXlsx(): Promise<Blob> {
  const mod = await import('@/lib/bulk-import/samples');
  return mod.generateTemplateSampleXlsx();
}

describe('generateUserSampleXlsx', () => {
  it('should return a valid .xlsx blob', async () => {
    const blob = await generateUserSampleXlsx();
    expect(blob).toBeInstanceOf(Blob);
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
  });

  it('should contain headers: name, email, role', async () => {
    const blob = await generateUserSampleXlsx();
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data[0]).toEqual(['name', 'email', 'role']);
  });

  it('should contain at least one example row', async () => {
    const blob = await generateUserSampleXlsx();
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(data[1]).toBeDefined();
    expect(data[1]!.length).toBe(3);
  });
});

describe('generateTemplateSampleXlsx', () => {
  it('should return a valid .xlsx blob', async () => {
    const blob = await generateTemplateSampleXlsx();
    expect(blob).toBeInstanceOf(Blob);
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
  });

  it('should contain headers: templateName, type, checkpointName, minConsultations, estimatedDuration', async () => {
    const blob = await generateTemplateSampleXlsx();
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data[0]).toEqual([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
  });

  it('should contain at least one example checkpoint row', async () => {
    const blob = await generateTemplateSampleXlsx();
    const buf = Buffer.from(await blob.arrayBuffer());
    const wb = read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(data[1]).toBeDefined();
    expect(data[1]!.length).toBe(5);
  });
});
