import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 30000,

    // Load .env files
    env: loadEnv('', process.cwd(), ''),

    // Performance: parallel execution (Vitest 4 syntax)
    pool: 'threads',
    maxWorkers: 14,
    fileParallelism: true,

    // Performance: persist transform cache between runs
    experimental: {
      fsModuleCache: true,
      importDurations: {
        print: 'on-warn',
        thresholds: { warn: 200, danger: 1000 },
      },
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
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
});
