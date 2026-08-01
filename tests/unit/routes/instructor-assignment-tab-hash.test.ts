import { describe, expect, it } from 'vitest';
import { getAssignmentTabFromHash } from '@/routes/_authenticated/instructor/assignments/$id';

describe('assignment detail tab hashes', () => {
  it.each([
    ['#consultations', 'consultations'],
    ['#extensions', 'extensions'],
    ['#discussions', 'discussions'],
    ['#interventions', 'interventions'],
  ])('maps %s to %s', (hash, expected) => {
    expect(getAssignmentTabFromHash(hash)).toBe(expected);
  });

  it('ignores unknown hashes', () => {
    expect(getAssignmentTabFromHash('#unknown')).toBeNull();
  });
});
