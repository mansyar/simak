/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { getActionVisualProps } from '@/lib/admin/audit-actions';

describe('getActionVisualProps', () => {
  it('should return verified + success for created', () => {
    expect(getActionVisualProps('assignment_created')).toEqual({
      dotVariant: 'verified',
      badgeVariant: 'success',
    });
  });

  it('should return verified + success for passed', () => {
    expect(getActionVisualProps('checkpoint_passed')).toEqual({
      dotVariant: 'verified',
      badgeVariant: 'success',
    });
  });

  it('should return verified + success for verified', () => {
    expect(getActionVisualProps('submission_verified')).toEqual({
      dotVariant: 'verified',
      badgeVariant: 'success',
    });
  });

  it('should return verified + success for unlocked', () => {
    expect(getActionVisualProps('submission_unlocked')).toEqual({
      dotVariant: 'verified',
      badgeVariant: 'success',
    });
  });

  it('should return inactive + warning for updated', () => {
    expect(getActionVisualProps('assignment_updated')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'warning',
    });
  });

  it('should return inactive + warning for extended', () => {
    expect(getActionVisualProps('deadline_extended')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'warning',
    });
  });

  it('should return inactive + error for deleted', () => {
    expect(getActionVisualProps('assignment_deleted')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'error',
    });
  });

  it('should return inactive + error for rejected', () => {
    expect(getActionVisualProps('extension_rejected')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'error',
    });
  });

  it('should return inactive + error for revised', () => {
    expect(getActionVisualProps('submission_revised')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'error',
    });
  });

  it('should return inactive + info for unknown action', () => {
    expect(getActionVisualProps('unknown_action')).toEqual({
      dotVariant: 'inactive',
      badgeVariant: 'info',
    });
  });
});
