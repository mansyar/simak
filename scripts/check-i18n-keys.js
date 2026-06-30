// @ts-check
// i18n key coverage check — compares t('key') usage against locale files
// Exit code 1 if keys are used in code but missing from locale files
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC_DIR = 'src';
const TESTS_DIR = 'tests';
const LOCALE_DIR = 'locales';
const ALLOWED_EXT = new Set(['.ts', '.tsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.output', 'dist', 'build', '.git', 'scripts']);
const EXCLUDE_GEN = /\.gen\.(ts|tsx)$/;

/**
 * Keys that are constructed dynamically at runtime (template literals, object
 * lookups, labelKey maps, etc.) and therefore cannot be found by the static
 * t('key') extractor. They are still valid and must not be reported as unused.
 */
const DYNAMIC_KEY_PATTERNS = [
  /^adminUsers\.role_(superadmin|admin|instructor|student)$/,
  /^adminAuditLog\.actionLabels\./,
  /^files\.review\.(passed|revise)$/,
  /^consultations\.status\.(pending|verified|rejected)$/,
  /^extensions\.category(Personal|Research|Health|Other)$/,
  /^extensions\.status(Pending|Approved|Rejected)$/,
  /^notifications\.groups\./,
  /^notifications\.events\./,
  /^error\.(unauthorized|forbidden|validation|badRequest|conflict|internal|network|default)$/,
  /^studentAssignments\.status\.(locked|unlocked)$/,
  // Sidebar labels are passed dynamically to t(link.label)
  /^adminSidebar\.(dashboard|users|templates|auditLog)$/,
  /^instructorSidebar\.(dashboard|assignments|reviews)$/,
  /^studentSidebar\.(dashboard|assignments|settings)$/,
  /^nav\.settings$/,
  // Email subjects are resolved server-side via resolveEmailSubject
  /^emails\.subjects\./,
  // Server-side error messages resolved via translateKey
  /^instructorReviews\.errors\.notInSubmittedState$/,
  // Bulk import result statuses and server-side skip reasons resolved via translateKey
  /^bulkImport\.users\.errors\./,
  /^bulkImport\.users\.status\./,
];

function isDynamicKey(key) {
  return DYNAMIC_KEY_PATTERNS.some((re) => re.test(key));
}

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
  // Match t('key'), t("key"), i18n.t('key'), and calls with interpolation
  // params such as t('key', { ... }). Require t preceded by word boundary
  // to avoid matching split('.') etc.
  const regex =
    /(?:(?:^|[^a-zA-Z0-9_])i18n\.|(?:^|[^a-zA-Z0-9_]))t\s*\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g;
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
  console.error(
    `❌ Failed to read locale files: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const enKeys = new Set(flattenKeys(en));
const idKeys = new Set(flattenKeys(id));

// Extract all keys from source files (t('key') usage)
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

// Tests may reference keys as bare strings (assertions, mocks, etc.).
// Any locale key that appears as a literal in a test file is treated as used.
const testFiles = collectFiles(TESTS_DIR);
const keysUsedInTests = new Set();

for (const file of testFiles) {
  try {
    const content = readFileSync(file, 'utf-8');
    for (const k of enKeys) {
      if (!usedKeys.has(k) && content.includes(k)) keysUsedInTests.add(k);
    }
  } catch {
    // skip unreadable files
  }
}

const effectivelyUsedKeys = new Set([...usedKeys, ...keysUsedInTests]);

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

const unusedEn = [...enKeys].filter((k) => !effectivelyUsedKeys.has(k) && !isDynamicKey(k));
const dynamicEn = [...enKeys].filter((k) => !effectivelyUsedKeys.has(k) && isDynamicKey(k));
if (unusedEn.length > 0) {
  console.log(`\n❌ ${unusedEn.length} key(s) in en.json but UNUSED in code:`);
  unusedEn.forEach((k) => console.log(`   ${k}`));
  hasError = true;
}

console.log(
  `\n📊 ${usedKeys.size} keys used in code · ${enKeys.size} in en.json · ${idKeys.size} in id.json · ${dynamicEn.length} dynamic key(s) whitelisted`,
);

if (hasError) {
  console.error('\n❌ i18n key coverage check FAILED.');
  process.exit(1);
} else {
  console.log('✅ All i18n keys are present in both locale files.');
}
