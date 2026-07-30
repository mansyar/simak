import { describe, it, expect, vi } from 'vitest';
import { buildStudentAtRiskHtml } from '@/lib/email-templates';

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
    LOG_LEVEL: 'info',
  }),
}));

describe('Email templates — buildStudentAtRiskHtml', () => {
  const params = {
    studentName: 'Alice Johnson',
    assignmentTitle: 'Thesis 2026',
    assignmentId: 9,
    riskLevel: 'high',
    riskFactors: 'Overdue checkpoint; Insufficient consultations',
  };

  it('includes student name, assignment title, risk level, and risk factors', () => {
    const html = buildStudentAtRiskHtml(params);
    expect(html).toContain('Alice Johnson');
    expect(html).toContain('Thesis 2026');
    expect(html).toContain('High');
    expect(html).toContain('Overdue checkpoint; Insufficient consultations');
  });

  it('includes the deep-link to instructor assignment page', () => {
    const html = buildStudentAtRiskHtml(params);
    expect(html).toContain('http://localhost:3000/instructor/assignments/9');
  });

  it('produces localized body for Indonesian locale', () => {
    const htmlId = buildStudentAtRiskHtml({ ...params, locale: 'id' });
    const htmlEn = buildStudentAtRiskHtml({ ...params, locale: 'en' });
    expect(htmlId).not.toEqual(htmlEn);
  });

  it('defaults to English when locale is undefined', () => {
    const htmlUndef = buildStudentAtRiskHtml(params);
    const htmlEn = buildStudentAtRiskHtml({ ...params, locale: 'en' });
    expect(htmlUndef).toEqual(htmlEn);
  });

  it('escapes malicious user input', () => {
    const html = buildStudentAtRiskHtml({
      studentName: '<script>alert(1)</script>',
      assignmentTitle: '<img src=x>',
      assignmentId: 1,
      riskLevel: 'medium',
      riskFactors: '<script>steal()</script>',
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });

  it('displays risk level label for medium', () => {
    const html = buildStudentAtRiskHtml({ ...params, riskLevel: 'medium' });
    expect(html).toContain('Medium');
  });

  it('displays risk level label for low', () => {
    const html = buildStudentAtRiskHtml({ ...params, riskLevel: 'low' });
    expect(html).toContain('Low');
  });
});
