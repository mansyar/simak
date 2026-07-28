import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 30000,
    pool: 'vmThreads',
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
});
