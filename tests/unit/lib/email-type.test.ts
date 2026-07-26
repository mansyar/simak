import { describe, it, expect } from 'vitest';
import type { TemplateType } from '@/lib/email';

describe('TemplateType union', () => {
  it('should include discussion_reply', () => {
    const value: TemplateType = 'discussion_reply';
    expect(value).toBe('discussion_reply');
  });
});
