import { describe, it, expect } from 'vitest';

import { Route } from '@/routes/_authenticated/settings';

describe('Settings Route', () => {
  it('should export Route', () => {
    expect(Route).toBeDefined();
  });

  it('should have component defined', () => {
    expect(Route.options?.component).toBeDefined();
  });
});
