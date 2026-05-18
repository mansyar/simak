// @ts-check
// Modularity check — enforces max 500 lines per source file
// Uses plain Node.js for speed (no tsx overhead, no experimental APIs)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const MAX_LINES = 500
const SOURCE_DIR = resolve(import.meta.dirname, '..', 'src')
const EXTENSIONS = new Set(['.ts', '.tsx'])
const EXCLUDE_FILES = new Set(['routeTree.gen.ts'])

/** @param {string} dir @returns {string[]} */
function collectFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name)) && !EXCLUDE_FILES.has(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

const files = collectFiles(SOURCE_DIR)
let hasError = false

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n').length

  if (lines > MAX_LINES) {
    console.error(`❌ ${file}: ${lines} lines (max: ${MAX_LINES})`)
    hasError = true
  }
}

if (hasError) {
  console.error('\n❌ Modularity check failed. Some files exceed the 500-line limit.')
  process.exit(1)
} else {
  console.log(`✅ All ${files.length} source files are within the ${MAX_LINES}-line limit.`)
}
