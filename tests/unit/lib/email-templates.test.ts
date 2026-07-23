import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEmailHeader,
  buildEmailFooter,
  buildSubmissionReceivedHtml,
  buildReviewCompletedHtml,
  buildRevisionRequestedHtml,
  buildConsultationVerifiedHtml,
  buildConsultationRejectedHtml,
  buildExtensionApprovedHtml,
  buildExtensionRejectedHtml,
  buildExtensionRequestedHtml,
  buildDeadlineReminderHtml,
} from '@/lib/email-templates';

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));

describe('Email templates — shared helpers', () => {
  describe('buildEmailHeader', () => {
    it('includes SIMAK branding', () => {
      const html = buildEmailHeader('en');
      expect(html).toContain('SIMAK');
      expect(html).toContain('Sistem Informasi dan Manajemen Akademik');
    });

    it('returns valid HTML structure', () => {
      const html = buildEmailHeader('en');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<table');
    });

    it('works for Indonesian locale', () => {
      const html = buildEmailHeader('id');
      expect(html).toContain('SIMAK');
    });
  });

  describe('buildEmailFooter', () => {
    it('includes copyright notice', () => {
      const html = buildEmailFooter('en');
      expect(html).toContain('SIMAK');
      expect(html).toMatch(/©|&copy;/);
    });

    it('returns valid HTML closing structure', () => {
      const html = buildEmailFooter('en');
      expect(html).toContain('</table>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });
  });
});

describe('Email templates — buildSubmissionReceivedHtml', () => {
  const params = {
    studentName: 'John Doe',
    assignmentName: 'Final Project',
    checkpointName: 'Draft Review',
    submissionId: 42,
  };

  it('includes contextual details (student, assignment, checkpoint)', () => {
    const html = buildSubmissionReceivedHtml(params);
    expect(html).toContain('John Doe');
    expect(html).toContain('Final Project');
    expect(html).toContain('Draft Review');
  });

  it('includes the deep-link to instructor review page', () => {
    const html = buildSubmissionReceivedHtml(params);
    expect(html).toContain('http://localhost:3000/instructor/reviews/42');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildSubmissionReceivedHtml({ ...params, locale: 'id' });
    const htmlEn = buildSubmissionReceivedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is null', () => {
    const htmlNull = buildSubmissionReceivedHtml({ ...params, locale: null });
    const htmlEn = buildSubmissionReceivedHtml({ ...params, locale: 'en' });
    expect(htmlNull).toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildSubmissionReceivedHtml(params);
    const htmlEn = buildSubmissionReceivedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildSubmissionReceivedHtml({
      studentName: '<script>alert(1)</script>',
      assignmentName: '<img src=x onerror=alert(1)>',
      checkpointName: 'Checkpoint',
      submissionId: 1,
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('Email templates — buildReviewCompletedHtml', () => {
  const params = {
    reviewerName: 'Dr. Smith',
    assignmentName: 'Final Project',
    checkpointName: 'Draft Review',
    assignmentId: 10,
  };

  it('includes reviewer name, assignment, and checkpoint', () => {
    const html = buildReviewCompletedHtml(params);
    expect(html).toContain('Dr. Smith');
    expect(html).toContain('Final Project');
    expect(html).toContain('Draft Review');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildReviewCompletedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/10');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildReviewCompletedHtml({ ...params, locale: 'id' });
    const htmlEn = buildReviewCompletedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildReviewCompletedHtml(params);
    const htmlEn = buildReviewCompletedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildReviewCompletedHtml({
      reviewerName: '<b>Evil</b>',
      assignmentName: 'Safe',
      checkpointName: 'Safe',
      assignmentId: 1,
    });
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).not.toContain('<b>Evil</b>');
  });
});

describe('Email templates — buildRevisionRequestedHtml', () => {
  const params = {
    reviewerName: 'Dr. Smith',
    assignmentName: 'Final Project',
    checkpointName: 'Draft Review',
    assignmentId: 10,
    revisionDeadline: '2026-08-01',
  };

  it('includes revision deadline', () => {
    const html = buildRevisionRequestedHtml(params);
    expect(html).toContain('2026-08-01');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildRevisionRequestedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/10');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildRevisionRequestedHtml({ ...params, locale: 'id' });
    const htmlEn = buildRevisionRequestedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildRevisionRequestedHtml(params);
    const htmlEn = buildRevisionRequestedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildRevisionRequestedHtml({
      reviewerName: '<script>x</script>',
      assignmentName: 'A',
      checkpointName: 'C',
      assignmentId: 1,
      revisionDeadline: '2026-08-01',
    });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});

describe('Email templates — buildConsultationVerifiedHtml', () => {
  const params = {
    instructorName: 'Prof. Lee',
    checkpointName: 'Consultation 1',
    assignmentId: 5,
  };

  it('includes instructor name and checkpoint', () => {
    const html = buildConsultationVerifiedHtml(params);
    expect(html).toContain('Prof. Lee');
    expect(html).toContain('Consultation 1');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildConsultationVerifiedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/5');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildConsultationVerifiedHtml({ ...params, locale: 'id' });
    const htmlEn = buildConsultationVerifiedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildConsultationVerifiedHtml(params);
    const htmlEn = buildConsultationVerifiedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildConsultationVerifiedHtml({
      instructorName: '<i>Evil</i>',
      checkpointName: 'C',
      assignmentId: 1,
    });
    expect(html).toContain('&lt;i&gt;Evil&lt;/i&gt;');
  });
});

describe('Email templates — buildConsultationRejectedHtml', () => {
  const params = {
    instructorName: 'Prof. Lee',
    checkpointName: 'Consultation 1',
    assignmentId: 5,
    rejectionReason: 'Not sufficient detail',
  };

  it('includes rejection reason', () => {
    const html = buildConsultationRejectedHtml(params);
    expect(html).toContain('Not sufficient detail');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildConsultationRejectedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/5');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildConsultationRejectedHtml({ ...params, locale: 'id' });
    const htmlEn = buildConsultationRejectedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildConsultationRejectedHtml(params);
    const htmlEn = buildConsultationRejectedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildConsultationRejectedHtml({
      instructorName: 'Prof. Lee',
      checkpointName: 'C',
      assignmentId: 1,
      rejectionReason: '<script>alert(1)</script>',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('Email templates — buildExtensionApprovedHtml', () => {
  const params = {
    instructorName: 'Prof. Lee',
    assignmentName: 'Final Project',
    assignmentId: 7,
    extensionDays: 5,
    newDeadline: '2026-08-15',
  };

  it('includes extension days and new deadline', () => {
    const html = buildExtensionApprovedHtml(params);
    expect(html).toContain('5');
    expect(html).toContain('2026-08-15');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildExtensionApprovedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/7');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildExtensionApprovedHtml({ ...params, locale: 'id' });
    const htmlEn = buildExtensionApprovedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildExtensionApprovedHtml(params);
    const htmlEn = buildExtensionApprovedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildExtensionApprovedHtml({
      instructorName: '<b>X</b>',
      assignmentName: 'A',
      assignmentId: 1,
      extensionDays: 3,
      newDeadline: '2026-08-15',
    });
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});

describe('Email templates — buildExtensionRejectedHtml', () => {
  const params = {
    instructorName: 'Prof. Lee',
    assignmentName: 'Final Project',
    assignmentId: 7,
    rejectionReason: 'No valid justification',
  };

  it('includes rejection reason', () => {
    const html = buildExtensionRejectedHtml(params);
    expect(html).toContain('No valid justification');
  });

  it('includes the deep-link to student assignment page', () => {
    const html = buildExtensionRejectedHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/7');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildExtensionRejectedHtml({ ...params, locale: 'id' });
    const htmlEn = buildExtensionRejectedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildExtensionRejectedHtml(params);
    const htmlEn = buildExtensionRejectedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildExtensionRejectedHtml({
      instructorName: 'Prof. Lee',
      assignmentName: 'A',
      assignmentId: 1,
      rejectionReason: '<img src=x>',
    });
    expect(html).toContain('&lt;img src=x&gt;');
  });
});

describe('Email templates — buildExtensionRequestedHtml', () => {
  const params = {
    studentName: 'Jane Doe',
    assignmentName: 'Final Project',
    assignmentId: 9,
    category: 'Medical',
    durationRequested: 7,
  };

  it('includes student name, assignment, category, and duration', () => {
    const html = buildExtensionRequestedHtml(params);
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Final Project');
    expect(html).toContain('Medical');
    expect(html).toContain('7');
  });

  it('includes the deep-link to instructor assignment page', () => {
    const html = buildExtensionRequestedHtml(params);
    expect(html).toContain('http://localhost:3000/instructor/assignments/9');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildExtensionRequestedHtml({ ...params, locale: 'id' });
    const htmlEn = buildExtensionRequestedHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildExtensionRequestedHtml(params);
    const htmlEn = buildExtensionRequestedHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildExtensionRequestedHtml({
      studentName: '<script>s</script>',
      assignmentName: 'A',
      assignmentId: 1,
      category: 'Medical',
      durationRequested: 3,
    });
    expect(html).toContain('&lt;script&gt;s&lt;/script&gt;');
  });
});

describe('Email templates — buildDeadlineReminderHtml', () => {
  const params = {
    assignmentTitle: 'Final Project',
    checkpointName: 'Draft Review',
    assignmentId: 5,
    checkpointId: 12,
    dueDate: '2026-07-30T23:59:59Z',
  };

  it('includes assignment title, checkpoint name, and due date', () => {
    const html = buildDeadlineReminderHtml(params);
    expect(html).toContain('Final Project');
    expect(html).toContain('Draft Review');
    expect(html).toContain('2026-07-30T23:59:59Z');
  });

  it('includes the deep-link to student checkpoint page', () => {
    const html = buildDeadlineReminderHtml(params);
    expect(html).toContain('http://localhost:3000/student/assignments/5/checkpoints/12');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildDeadlineReminderHtml({ ...params, locale: 'id' });
    const htmlEn = buildDeadlineReminderHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildDeadlineReminderHtml(params);
    const htmlEn = buildDeadlineReminderHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildDeadlineReminderHtml({
      assignmentTitle: '<script>alert(1)</script>',
      checkpointName: 'Draft',
      assignmentId: 1,
      checkpointId: 2,
      dueDate: '2026-07-30',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
