import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const MAX_LINES = 500
const SOURCE_GLOB = 'src/**/*.{ts,tsx}'
const EXCLUDE_PATTERNS = ['src/routeTree.gen.ts']

const files = globSync(SOURCE_GLOB, { ignore: EXCLUDE_PATTERNS })
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
