/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
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
        'src/i18n/index.ts',
        'src/db/schema/**',
        'src/hooks/**',
        'src/routes/**',
        'src/components/ui/**',
        'src/lib/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
