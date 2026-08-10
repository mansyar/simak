import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repoRoot, 'src', 'assets', 'fonts', 'noto-sans');
const targetDir = path.join(repoRoot, '.output', 'server', 'assets', 'fonts', 'noto-sans');

const entries = readdirSync(sourceDir).filter((entry) => entry.endsWith('.ttf'));
if (entries.length === 0) {
  console.error('copy-report-fonts: no font files found in', sourceDir);
  process.exit(1);
}
mkdirSync(targetDir, { recursive: true });
for (const entry of entries) {
  copyFileSync(path.join(sourceDir, entry), path.join(targetDir, entry));
}
console.log(`copy-report-fonts: copied ${entries.join(', ')} to ${targetDir}`);
