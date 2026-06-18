// @ts-check
// Modularity check — enforces max 500 lines per source file
// Runs on files passed via CLI args (pre-commit hook passes staged files)
// Only checks src/, tests/, and scripts/ directories
import { readFileSync } from 'node:fs'
import { extname, normalize } from 'node:path'

const MAX_LINES = 500
const ALLOWED_DIRS = ['src', 'tests', 'scripts']
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js'])
// Generated files pattern (e.g. routeTree.gen.ts) — skip line limit checks
const EXCLUDE_GEN_PATTERN = /\.gen\.(ts|tsx)$/
// Known auto-generated file paths (relative to project root)
const EXCLUDE_PATHS = new Set([
  'src/i18n/types.ts',
  'src/i18n/detect-locale.ts',
  'scripts/generate-i18n-types.ts',
])

/** @param {string} filePath @returns {boolean} */
function isInAllowedDir(filePath) {
  const normalized = normalize(filePath).replace(/\\/g, '/')
  return ALLOWED_DIRS.some((dir) => normalized.startsWith(dir) || normalized.includes(`/${dir}/`))
}

/** Convert an absolute path to a relative path (relative to cwd) */
function toRelative(filePath) {
  const normalized = normalize(filePath).replace(/\\/g, '/')
  const cwd = process.cwd().replace(/\\/g, '/')
  if (normalized.startsWith(cwd + '/')) return normalized.slice(cwd.length + 1)
  return normalized
}

// Accept files from CLI args (passed by pre-commit hook)
const stagedFiles = process.argv.slice(2)

if (stagedFiles.length === 0) {
  console.log('ℹ️  No files to check.')
  process.exit(0)
}

let hasError = false
let checkedCount = 0

for (const file of stagedFiles) {
  if (!ALLOWED_EXT.has(extname(file)) || !isInAllowedDir(file)) continue
  const fileName = file.split(/[/\\]/).pop() ?? ''
  if (EXCLUDE_GEN_PATTERN.test(fileName) || EXCLUDE_PATHS.has(toRelative(file))) continue

  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n').length
  checkedCount++

  if (lines > MAX_LINES) {
    console.error(`❌ ${file}: ${lines} lines (max: ${MAX_LINES})`)
    hasError = true
  }
}

if (hasError) {
  console.error('\n❌ Modularity check failed. Some files exceed the 500-line limit.')
  process.exit(1)
} else {
  console.log(`✅ All ${checkedCount} staged files are within the ${MAX_LINES}-line limit.`)
}
