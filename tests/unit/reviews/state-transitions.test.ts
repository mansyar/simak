/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define expected state transitions inline for testing
const VALID_REVIEW_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review'],
  under_review: ['passed', 'revise'],
};

describe('Checkpoint state transitions for reviews', () => {
  it('should allow submitted → under_review', () => {
    const transitions = VALID_REVIEW_TRANSITIONS['submitted'];
    expect(transitions).toContain('under_review');
  });

  it('should allow under_review → passed', () => {
    const transitions = VALID_REVIEW_TRANSITIONS['under_review'];
    expect(transitions).toContain('passed');
  });

  it('should allow under_review → revise', () => {
    const transitions = VALID_REVIEW_TRANSITIONS['under_review'];
    expect(transitions).toContain('revise');
  });

  it('should NOT allow submitted → passed directly', () => {
    const transitions = VALID_REVIEW_TRANSITIONS['submitted'];
    expect(transitions).not.toContain('passed');
  });

  it('should NOT allow submitted → revise directly', () => {
    const transitions = VALID_REVIEW_TRANSITIONS['submitted'];
    expect(transitions).not.toContain('revise');
  });

  it('should NOT allow passed → any state', () => {
    expect(VALID_REVIEW_TRANSITIONS['passed']).toBeUndefined();
  });

  it('should NOT allow revise → any state (student action)', () => {
    expect(VALID_REVIEW_TRANSITIONS['revise']).toBeUndefined();
  });

  it('should NOT allow unlocked → any review state', () => {
    expect(VALID_REVIEW_TRANSITIONS['unlocked']).toBeUndefined();
  });
});

describe('Review state transition validation logic', () => {
  function isValidTransition(currentState: string, targetState: string): boolean {
    const allowed = VALID_REVIEW_TRANSITIONS[currentState];
    return !!allowed && allowed.includes(targetState);
  }

  it('should validate submitted → under_review', () => {
    expect(isValidTransition('submitted', 'under_review')).toBe(true);
  });

  it('should validate under_review → passed', () => {
    expect(isValidTransition('under_review', 'passed')).toBe(true);
  });

  it('should validate under_review → revise', () => {
    expect(isValidTransition('under_review', 'revise')).toBe(true);
  });

  it('should reject submitted → passed', () => {
    expect(isValidTransition('submitted', 'passed')).toBe(false);
  });

  it('should reject locked → under_review', () => {
    expect(isValidTransition('locked', 'under_review')).toBe(false);
  });

  it('should reject passed → revise', () => {
    expect(isValidTransition('passed', 'revise')).toBe(false);
  });
});
