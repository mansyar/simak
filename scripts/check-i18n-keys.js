// @ts-check
// i18n key coverage check — compares t('key') usage against locale files
// Exit code 1 if keys are used in code but missing from locale files
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC_DIR = 'src';
const LOCALE_DIR = 'locales';
const ALLOWED_EXT = new Set(['.ts', '.tsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.output', 'dist', 'build', '.git', 'scripts']);
const EXCLUDE_GEN = /\.gen\.(ts|tsx)$/;

/**
 * Flatten nested JSON object into dot-notation key paths
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(path);
    else keys.push(...flattenKeys(/** @type {Record<string, unknown>} */ (v), path));
  }
  return keys;
}

/**
 * Recursively collect all .ts/.tsx files from a directory
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry) || entry.startsWith('.')) continue;
      files.push(...collectFiles(full));
    } else if (ALLOWED_EXT.has(extname(entry)) && !EXCLUDE_GEN.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Extract all i18n translation keys from source file content
 * Matches t('key'), t("key"), i18n.t('key'), etc.
 * @param {string} content
 * @returns {Set<string>}
 */
function extractKeys(content) {
  const keys = new Set();
  // Match t('key') or t("key") or i18n.t('key') — captures the key
  // Require t preceded by word boundary to avoid matching split('.') etc.
  const regex = /(?:(?:^|[^a-zA-Z0-9_])i18n\.|(?:^|[^a-zA-Z0-9_]))t\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// ---- Main ----

// Load locale files
/** @type {Record<string, unknown>} */
let en, id;
try {
  en = JSON.parse(readFileSync(join(LOCALE_DIR, 'en.json'), 'utf-8'));
  id = JSON.parse(readFileSync(join(LOCALE_DIR, 'id.json'), 'utf-8'));
} catch (err) {
  console.error(`❌ Failed to read locale files: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const enKeys = new Set(flattenKeys(en));
const idKeys = new Set(flattenKeys(id));

// Extract all keys from source files
const sourceFiles = collectFiles(SRC_DIR);
const usedKeys = new Set();

for (const file of sourceFiles) {
  try {
    const content = readFileSync(file, 'utf-8');
    const fileKeys = extractKeys(content);
    for (const k of fileKeys) usedKeys.add(k);
  } catch {
    // skip unreadable files
  }
}

let hasError = false;

const missingEn = [...usedKeys].filter((k) => !enKeys.has(k));
if (missingEn.length > 0) {
  console.error(`❌ ${missingEn.length} key(s) used in code but MISSING from en.json:`);
  missingEn.forEach((k) => console.error(`   ${k}`));
  hasError = true;
}

const missingId = [...usedKeys].filter((k) => !idKeys.has(k));
if (missingId.length > 0) {
  console.error(`\n❌ ${missingId.length} key(s) used in code but MISSING from id.json:`);
  missingId.forEach((k) => console.error(`   ${k}`));
  hasError = true;
}

const unusedEn = [...enKeys].filter((k) => !usedKeys.has(k));
if (unusedEn.length > 0) {
  console.log(`\nℹ️  ${unusedEn.length} key(s) in en.json but UNUSED in code:`);
  unusedEn.forEach((k) => console.log(`   ${k}`));
}

console.log(
  `\n📊 ${usedKeys.size} keys used in code · ${enKeys.size} in en.json · ${idKeys.size} in id.json`,
);

if (hasError) {
  console.error('\n❌ i18n key coverage check FAILED.');
  process.exit(1);
} else {
  console.log('✅ All i18n keys are present in both locale files.');
}
