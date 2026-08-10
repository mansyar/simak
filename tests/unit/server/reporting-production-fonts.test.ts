/** @vitest-environment node */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const serverOutputDir = path.join(repoRoot, '.output', 'server');
const fontsDir = path.join(serverOutputDir, 'assets', 'fonts', 'noto-sans');
const built = existsSync(path.join(serverOutputDir, 'index.mjs'));

const smokeEntry = path.join(serverOutputDir, '_ssr', 'reporting-font-smoke.mjs');

const chunkScript = `
import { renderReportPdf } from ${JSON.stringify(`file://${smokeEntry.replace(/\\/g, '/')}`)};
const pdf = await renderReportPdf({
  type: 'official_transcript',
  locale: 'en',
  generatedAt: new Date('2026-08-10T00:00:00.000Z'),
  institution: { name: 'Universitas SIMAK', address: 'Jl. Pendidikan 1' },
  filters: { termId: null, courseId: null, sectionId: null, cohort: null },
  data: {
    filters: { termId: null, courseId: null, sectionId: null, cohort: null },
    student: { id: 'smoke-student', name: 'Smoke Student' },
    termGpa: null,
    cumulativeGpa: null,
    records: [],
  },
});
if (pdf[0] !== 0x25 || pdf[1] !== 0x50 || pdf[2] !== 0x44 || pdf[3] !== 0x46) {
  throw new Error('renderReportPdf did not return a PDF');
}
console.log('PDF_OK ' + pdf.length);
`;

describe.skipIf(!built)('production output font smoke', () => {
  it('emits the bundled bilingual fonts under .output/server/assets/fonts', () => {
    expect(existsSync(path.join(fontsDir, 'NotoSans-Regular.ttf'))).toBe(true);
    expect(existsSync(path.join(fontsDir, 'NotoSans-Bold.ttf'))).toBe(true);
  });

  it('bundles a production smoke entry for the PDF renderer under .output/server/_ssr', () => {
    expect(existsSync(smokeEntry)).toBe(true);
    const rendererChunks = readdirSync(path.join(serverOutputDir, '_ssr')).filter(
      (entry) => entry.startsWith('reporting-orchestration.server-') && entry.endsWith('.mjs'),
    );
    expect(rendererChunks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a PDF from the production output entry without missing-font failures', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '-e', chunkScript],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://simak:simak_password@localhost:5432/simak',
          RESEND_API_KEY: 're_dummy',
          BETTER_AUTH_SECRET: 'dummy-secret',
          BETTER_AUTH_URL: 'http://localhost:3000',
          SUPERADMIN_EMAIL: 'admin@simak.test',
          SUPERADMIN_PASSWORD: 'dummy-password',
        },
        timeout: 30_000,
      },
    );
    expect(stdout).toMatch(/^PDF_OK \d+/);
  });
});
