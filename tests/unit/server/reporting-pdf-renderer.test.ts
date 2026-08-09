/** @vitest-environment node */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { renderReportPdf } from '@/server/reporting-pdf-renderer.server';

const generatedAt = new Date('2026-08-10T09:30:00.000Z');
const institution = {
  name: 'Universitas SIMAK',
  address: 'Jl. Pendidikan 1, Jakarta',
};
const filters = { termId: 7, courseId: 3, sectionId: 9, cohort: '2026' };

async function inspectPdf(buffer: Buffer) {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((item): item is typeof item & { str: string } => 'str' in item)
        .map((item) => item.str)
        .join(' '),
    );
  }
  return { pages, text: pages.join(' '), pageCount: document.numPages };
}

describe('server-only report PDF renderer', () => {
  it.each([
    ['en', 'Institutional Academic Summary', 'Generated at', 'Applied filters', 'Term: 7'],
    ['id', 'Ringkasan Akademik Institusi', 'Dibuat pada', 'Filter diterapkan', 'Periode: 7'],
  ] as const)(
    'renders the institutional summary in %s',
    async (locale, title, timestamp, filterLabel, termFilter) => {
      const pdf = await renderReportPdf({
        type: 'institutional_academic_summary',
        locale,
        generatedAt,
        institution,
        filters,
        data: {
          filters,
          totals: { students: 8, records: 10, credits: 30, averageScore: 84.5 },
          outcomes: [
            { status: 'incomplete', count: 2 },
            { status: 'complete', count: 8 },
          ],
        },
      });
      const result = await inspectPdf(pdf);

      expect(result.text).toContain(institution.name);
      expect(result.text).toContain(institution.address);
      expect(result.text).toContain(title);
      expect(result.text).toContain(timestamp);
      expect(result.text).toContain(filterLabel);
      expect(result.text).toContain('2026-08-10 09:30 UTC');
      expect(result.text).toContain(termFilter);
      expect(result.text.indexOf('complete')).toBeLessThan(result.text.indexOf('incomplete'));
    },
  );

  it.each([
    ['en', 'Analytics Summary', 'Completion rate'],
    ['id', 'Ringkasan Analitik', 'Tingkat penyelesaian'],
  ] as const)(
    'renders safe, deterministically ordered analytics in %s',
    async (locale, title, rateLabel) => {
      const unsafeText = 'B <script>alert(1)</script> (admin) \\ report';
      const pdf = await renderReportPdf({
        type: 'analytics_summary',
        locale,
        generatedAt,
        institution,
        filters: { ...filters, cohort: unsafeText },
        data: {
          filters: { ...filters, cohort: unsafeText },
          sections: [
            {
              sectionId: 2,
              sectionCode: unsafeText,
              students: 4,
              activeAssignments: 1,
              passedCheckpoints: 3,
              totalCheckpoints: 4,
              completionRate: 75,
            },
            {
              sectionId: 1,
              sectionCode: 'A-01',
              students: 5,
              activeAssignments: 2,
              passedCheckpoints: 8,
              totalCheckpoints: 10,
              completionRate: 80,
            },
          ],
        },
      });
      const result = await inspectPdf(pdf);

      expect(result.text).toContain(title);
      expect(result.text).toContain(rateLabel);
      expect(result.text).toContain(unsafeText);
      expect(result.text.indexOf('A-01')).toBeLessThan(result.text.lastIndexOf(unsafeText));
      expect(pdf.toString('latin1')).not.toMatch(/\/JavaScript|\/JS\b|\/OpenAction/);
    },
  );

  it.each([
    ['en', 'Official Transcript', 'Student', 'Cumulative GPA'],
    ['id', 'Transkrip Resmi', 'Mahasiswa', 'IPK Kumulatif'],
  ] as const)(
    'renders a multi-page official transcript in %s',
    async (locale, title, studentLabel, gpaLabel) => {
      const records = Array.from({ length: 120 }, (_, index) => ({
        recordId: index + 1,
        courseCode: `IF${String(120 - index).padStart(3, '0')}`,
        courseName: `Mata Kuliah ${index + 1}`,
        sectionCode: 'A',
        termCode: '2026-1',
        termName: 'Semester Ganjil',
        status: 'complete' as const,
        numericScore: 90,
        letterGrade: 'A',
        credits: 3,
        gradePoints: 4,
        publishedAt: new Date('2026-06-01T00:00:00.000Z'),
      }));
      const pdf = await renderReportPdf({
        type: 'official_transcript',
        locale,
        generatedAt,
        institution,
        filters,
        data: {
          filters,
          student: { id: 'student-1', name: 'Siti Nur Aisyah' },
          termGpa: { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [1] },
          cumulativeGpa: {
            gpa: 3.95,
            totalCredits: 360,
            totalQualityPoints: 1422,
            eligibleRecordIds: records.map((record) => record.recordId),
          },
          records,
        },
      });
      const result = await inspectPdf(pdf);

      expect(result.pageCount).toBeGreaterThan(1);
      expect(result.text).toContain(title);
      expect(result.text).toContain(studentLabel);
      expect(result.text).toContain(gpaLabel);
      expect(result.text).toContain('Siti Nur Aisyah');
      expect(result.text).toContain('IF001');
      expect(result.text).toContain('IF120');
      expect(
        result.pages.map((page, index) => page.includes(`${index + 1} / ${result.pageCount}`)),
      ).toEqual(Array.from({ length: result.pageCount }, () => true));
    },
  );

  it.each([
    [
      'term GPA',
      null,
      { gpa: 3.8, totalCredits: 30, totalQualityPoints: 114, eligibleRecordIds: [1] as number[] },
      'Term GPA: -',
    ],
    [
      'cumulative GPA',
      { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [1] as number[] },
      null,
      'Cumulative GPA: -',
    ],
  ] as const)('renders missing %s safely', async (_, termGpa, cumulativeGpa, expected) => {
    const pdf = await renderReportPdf({
      type: 'official_transcript',
      locale: 'en',
      generatedAt,
      institution,
      filters,
      data: {
        filters,
        student: { id: 'student-1', name: 'Siti Nur Aisyah' },
        termGpa,
        cumulativeGpa,
        records: [],
      },
    });

    await expect(inspectPdf(pdf)).resolves.toMatchObject({
      text: expect.stringContaining(expected),
    });
  });
});
