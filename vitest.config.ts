import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

const xlsxTestFiles = [
  'tests/unit/lib/parse-templates-xlsx.test.ts',
  'tests/unit/lib/parse-users-xlsx.test.ts',
  'tests/unit/lib/sample-generators.test.ts',
  'tests/unit/lib/excel-export.test.ts',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
    // Prefer .ts/.tsx source over stale compiled .js files
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 30000,

    // Load .env files
    env: loadEnv('', process.cwd(), ''),

    // Use process isolation because Zod 4's lazy JIT schemas can access stale
    // Vitest VM globals in VM worker pools, producing unhandled defineProperty errors.
    pool: 'forks',
    maxWorkers: 8,
    fileParallelism: true,

    // Performance: persist transform cache between runs
    experimental: {
      fsModuleCache: true,
      //Only enable importsDuration on debugging
      // importDurations: {
      //   print: 'on-warn',
      //   thresholds: { warn: 200, danger: 1000 },
      // },
    },

    // Suppress console noise in test output
    onConsoleLog(log, type) {
      if (type === 'stderr' || type === 'stdout') return false;
    },

    // Faster reporter
    reporters: ['dot'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/routeTree.gen.ts',
        'src/router.tsx',
        'src/i18n/types.ts',
        'src/i18n/detect-locale.ts',
        'src/db/migrate.ts',
        'src/components/ui/**',
        'src/routes/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    // Projects: unit tests run in forked processes (inherited), xlsx tests on threads.
    // Bare `vitest run` executes both projects — no script-level flags needed.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['node_modules', 'dist', 'tests/integration/**', ...xlsxTestFiles],
        },
      },
      {
        extends: true,
        test: {
          name: 'xlsx',
          pool: 'threads',
          include: xlsxTestFiles,
          exclude: ['node_modules', 'dist'],
        },
      },
    ],
  },
});
