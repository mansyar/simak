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
 * Placeholder parser — will be implemented in src/lib/bulk-import/parse-templates.ts.
 */
async function parseTemplatesXlsx(file: File): Promise<{
  groups: Array<{
    templateName: string;
    type: string;
    checkpoints: Array<{ name: string; minConsultations: number; estimatedDuration: number }>;
    status: 'valid' | 'invalid';
    error?: string;
  }>;
  errors: string[];
}> {
  const mod = await import('@/lib/bulk-import/parse-templates');
  return mod.parseTemplatesXlsx(file);
}

function fileFromBuffer(buf: Buffer, name = 'templates.xlsx'): File {
  return new File([new Uint8Array(buf)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseTemplatesXlsx', () => {
  describe('Header validation', () => {
    it('should accept exact headers: templateName, type, checkpointName, minConsultations, estimatedDuration', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.errors).toHaveLength(0);
      expect(result.groups).toHaveLength(1);
    });

    it('should reject missing required header', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName'],
        ['Template A', 'Assignment', 'Checkpoint 1'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Grouping by templateName', () => {
    it('should group rows with the same templateName into one template', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', '7'],
        ['Template A', 'Assignment', 'Checkpoint 2', '1', '14'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].templateName).toBe('Template A');
      expect(result.groups[0].checkpoints).toHaveLength(2);
    });

    it('should create separate groups for different templateNames', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', '7'],
        ['Template B', 'Quiz', 'Checkpoint 1', '0', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].templateName).toBe('Template A');
      expect(result.groups[1].templateName).toBe('Template B');
    });
  });

  describe('Type consistency', () => {
    it('should reject group with inconsistent type across rows', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', '7'],
        ['Template A', 'Quiz', 'Checkpoint 2', '0', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].status).toBe('invalid');
      expect(result.groups[0].error).toBeDefined();
    });
  });

  describe('Checkpoint validation', () => {
    it('should reject group with empty checkpoint name', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', '', '0', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups[0].status).toBe('invalid');
      expect(result.groups[0].error).toBeDefined();
    });

    it('should default minConsultations to 0 when blank', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups[0].checkpoints[0].minConsultations).toBe(0);
    });

    it('should default estimatedDuration to 7 when blank', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', ''],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups[0].checkpoints[0].estimatedDuration).toBe(7);
    });
  });

  describe('Numeric validation', () => {
    it('should mark group as invalid if minConsultations is non-numeric', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', 'abc', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups[0].status).toBe('invalid');
    });

    it('should mark group as invalid if estimatedDuration is non-numeric', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', 'abc'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups[0].status).toBe('invalid');
    });
  });

  describe('Per-group validity', () => {
    it('should mark valid groups as valid and invalid groups as invalid', async () => {
      const buf = buildXlsx([
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
        ['Template A', 'Assignment', 'Checkpoint 1', '0', '7'],
        ['Template B', '', 'Checkpoint 1', '0', '7'],
      ]);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].status).toBe('valid');
      expect(result.groups[1].status).toBe('invalid');
    });
  });

  describe('Row-limit enforcement', () => {
    it('should reject files exceeding 500 checkpoint rows', async () => {
      const rows: string[][] = [
        ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
      ];
      for (let i = 0; i < 501; i++) {
        rows.push([`Template ${i}`, 'Assignment', `Checkpoint ${i}`, '0', '7']);
      }
      const buf = buildXlsx(rows);
      const file = fileFromBuffer(buf);
      const result = await parseTemplatesXlsx(file);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
