import { describe, it, expect, vi } from 'vitest';
import { buildDiscussionReplyHtml } from '@/lib/email-templates';

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
    LOG_LEVEL: 'info',
  }),
}));

describe('Email templates — buildDiscussionReplyHtml', () => {
  const baseParams = {
    authorName: 'Alice Johnson',
    checkpointName: 'Draft Review',
    assignmentTitle: 'Thesis 2026',
    messagePreview: 'Can you clarify the formatting requirements?',
    assignmentId: 5,
    checkpointId: 12,
    target: 'instructor' as const,
  };

  it('includes author name, checkpoint name, assignment title, and message preview', () => {
    const html = buildDiscussionReplyHtml(baseParams);
    expect(html).toContain('Alice Johnson');
    expect(html).toContain('Draft Review');
    expect(html).toContain('Thesis 2026');
    expect(html).toContain('Can you clarify the formatting requirements?');
  });

  it('truncates message preview to 100 chars', () => {
    const longMessage = 'A'.repeat(150);
    const html = buildDiscussionReplyHtml({ ...baseParams, messagePreview: longMessage });
    expect(html).toContain('A'.repeat(100));
    expect(html).not.toContain('A'.repeat(101));
  });

  it('HTML-escapes the message preview', () => {
    const html = buildDiscussionReplyHtml({
      ...baseParams,
      messagePreview: '<script>alert(1)</script>',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('CTA link for student target points to checkpoint page', () => {
    const html = buildDiscussionReplyHtml({ ...baseParams, target: 'student' });
    expect(html).toContain('http://localhost:3000/student/assignments/5/checkpoints/12');
  });

  it('CTA link for instructor target points to assignment page', () => {
    const html = buildDiscussionReplyHtml({ ...baseParams, target: 'instructor' });
    expect(html).toContain('http://localhost:3000/instructor/assignments/5');
    expect(html).not.toContain('/checkpoints/12');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildDiscussionReplyHtml({ ...baseParams, locale: 'id' });
    const htmlEn = buildDiscussionReplyHtml({ ...baseParams, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildDiscussionReplyHtml(baseParams);
    const htmlEn = buildDiscussionReplyHtml({ ...baseParams, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input in author name, checkpoint name, and assignment title', () => {
    const html = buildDiscussionReplyHtml({
      ...baseParams,
      authorName: '<script>alert(1)</script>',
      checkpointName: '<img src=x>',
      assignmentTitle: '<script>steal()</script>',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });

  it('uses STRINGS[locale].discussionReply for intro text', () => {
    const htmlEn = buildDiscussionReplyHtml({ ...baseParams, locale: 'en' });
    const htmlId = buildDiscussionReplyHtml({ ...baseParams, locale: 'id' });
    // English and Indonesian intro texts should differ
    expect(htmlEn).not.toEqual(htmlId);
    // Both should contain a paragraph element as the intro
    expect(htmlEn).toContain('<p style="font-size: 16px;');
    expect(htmlId).toContain('<p style="font-size: 16px;');
  });
});
