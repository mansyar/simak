/** @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const repoRoot = resolve(__dirname, '../..');

function runOxlint(fixturePath: string) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['exec', 'oxlint', '--format', 'json', fixturePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
  });
  const raw = result.stdout ?? '';
  const json = raw.substring(raw.indexOf('{'));
  return JSON.parse(json);
}

describe('simak-i18n/no-hardcoded lint plugin', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'simak-lint-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('flags hardcoded English strings assigned to titleKey or messageKey', () => {
    const fixture = join(tmpDir, 'bad-notification-insert.js');
    writeFileSync(
      fixture,
      `
      export function badInsert() {
        return {
          titleKey: 'Hardcoded Title',
          messageKey: 'Hardcoded message',
        };
      }
      `,
      'utf8',
    );

    const result = runOxlint(fixture);
    const messages = result.diagnostics.map((d: { message: string }) => d.message);

    expect(messages).toContain('Hardcoded text "Hardcoded Title" — use t(\'key\') instead');
    expect(messages).toContain('Hardcoded text "Hardcoded message" — use t(\'key\') instead');
  });

  it('allows translation keys assigned to titleKey or messageKey', () => {
    const fixture = join(tmpDir, 'good-notification-insert.js');
    writeFileSync(
      fixture,
      `
      export function goodInsert() {
        return {
          titleKey: 'notifications.events.review_completed.title',
          messageKey: 'notifications.events.review_completed.message',
        };
      }
      `,
      'utf8',
    );

    const result = runOxlint(fixture);
    expect(result.diagnostics).toHaveLength(0);
  });
});
