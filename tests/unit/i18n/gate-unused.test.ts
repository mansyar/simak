import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('i18n unused-key gate', () => {
  it('passes when locale files have no unused keys', () => {
    const result = spawnSync('node', ['scripts/check-i18n-keys.js'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('in en.json');
    expect(result.stdout).toContain('in id.json');
  });

  it('fails when an intentionally-unused key exists', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'simak-i18n-gate-'));

    mkdirSync(join(tempRoot, 'locales'), { recursive: true });
    mkdirSync(join(tempRoot, 'scripts'), { recursive: true });
    mkdirSync(join(tempRoot, 'src'), { recursive: true });

    // Minimal locale files with one deliberately-unused key
    const locale = { used: { key: 'Used' }, intentionally: { unused: 'Unused' } };
    writeFileSync(join(tempRoot, 'locales', 'en.json'), JSON.stringify(locale, null, 2));
    writeFileSync(join(tempRoot, 'locales', 'id.json'), JSON.stringify(locale, null, 2));

    // One used key so the extractor sees something (backtick form is not matched by the static regex)
    writeFileSync(join(tempRoot, 'src', 'dummy.tsx'), 't(`used.key`)\n');

    // Copy the checker script so it resolves relative paths from the temp root
    cpSync(
      join(process.cwd(), 'scripts', 'check-i18n-keys.js'),
      join(tempRoot, 'scripts', 'check-i18n-keys.js'),
    );

    const result = spawnSync('node', ['scripts/check-i18n-keys.js', '--show-unused'], {
      cwd: tempRoot,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('intentionally.unused');
  });
});
