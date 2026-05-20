import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Admin templates i18n types', () => {
  const typesPath = resolve(import.meta.dirname, '../../../src/i18n/types.ts');
  const typesContent = readFileSync(typesPath, 'utf-8');

  it('should have adminTemplates section in Translation type', () => {
    expect(typesContent).toContain('adminTemplates');
  });

  it('should have all required adminTemplates keys', () => {
    const requiredKeys = [
      'title',
      'newTemplate',
      'searchPlaceholder',
      'filterByType',
      'checkpointCount',
      'empty',
      'createPrompt',
    ];
    const formKeys = [
      'name',
      'type',
      'checkpoints',
      'checkpointName',
      'addCheckpoint',
      'removeCheckpoint',
      'moveUp',
      'moveDown',
    ];
    const actionKeys = ['edit', 'duplicate', 'delete'];
    const messageKeys = [
      'createSuccess',
      'updateSuccess',
      'duplicateSuccess',
      'deleteConfirm',
      'deleteInUse',
      'deleteSuccess',
      'inUseBanner',
    ];

    // Check form section exists
    expect(typesContent).toContain('form:');
    expect(typesContent).toContain('actions:');

    // Check all required keys are present somewhere
    for (const key of [...requiredKeys, ...formKeys, ...actionKeys, ...messageKeys]) {
      expect(typesContent).toContain(key);
    }
  });
});
