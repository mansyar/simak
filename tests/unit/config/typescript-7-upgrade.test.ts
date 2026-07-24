/** @vitest-environment node */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

function readJson(relativePath: string): Record<string, unknown> {
  const content = readFileSync(join(projectRoot, relativePath), 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

function readText(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), 'utf-8');
}

describe('TypeScript 7 upgrade configuration', () => {
  describe('tsconfig.json', () => {
    it('should not contain baseUrl property', () => {
      const tsconfig = readJson('tsconfig.json');
      const compilerOptions = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
      expect(compilerOptions.baseUrl).toBeUndefined();
    });

    it('should retain paths mapping for @/* alias', () => {
      const tsconfig = readJson('tsconfig.json');
      const compilerOptions = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
      const paths = (compilerOptions.paths ?? {}) as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['./src/*']);
    });
  });

  describe('package.json', () => {
    it('should specify typescript ^7.0.0 or higher in devDependencies', () => {
      const pkg = readJson('package.json');
      const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
      const tsVersion = devDeps.typescript;
      expect(tsVersion).toBeDefined();
      const match = tsVersion?.match(/(\d+)\./);
      const majorVersion = match ? parseInt(match[1], 10) : 0;
      expect(majorVersion).toBeGreaterThanOrEqual(7);
    });
  });

  describe('lefthook.yml', () => {
    it('should include --checkers flag in pre-push typecheck command', () => {
      const content = readText('lefthook.yml');
      expect(content).toContain('--checkers');
    });
  });
});
