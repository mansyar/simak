import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { NormalizedReportFilters, ReportLocale } from '@/lib/reporting-policy';
import type {
  getAnalyticsSummaryHandler,
  getInstitutionalAcademicSummaryHandler,
  getOfficialTranscriptHandler,
} from './reporting-loaders.server';

const REGULAR_FONT = fileURLToPath(
  new URL('../assets/fonts/noto-sans/NotoSans-Regular.ttf', import.meta.url),
);
const BOLD_FONT = fileURLToPath(
  new URL('../assets/fonts/noto-sans/NotoSans-Bold.ttf', import.meta.url),
);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 58;

type Institution = { name: string; address?: string | null };
type BaseRequest = {
  locale: ReportLocale;
  generatedAt: Date;
  institution: Institution;
  filters: NormalizedReportFilters;
};
type LoaderData<T extends (...args: never[]) => unknown> = Exclude<
  Awaited<ReturnType<T>>,
  { error: unknown }
>;

export type ReportPdfRequest =
  | (BaseRequest & {
      type: 'institutional_academic_summary';
      data: LoaderData<typeof getInstitutionalAcademicSummaryHandler>;
    })
  | (BaseRequest & {
      type: 'analytics_summary';
      data: LoaderData<typeof getAnalyticsSummaryHandler>;
    })
  | (BaseRequest & {
      type: 'official_transcript';
      data: LoaderData<typeof getOfficialTranscriptHandler>;
    });

const COPY = {
  en: {
    titles: {
      institutional_academic_summary: 'Institutional Academic Summary',
      analytics_summary: 'Analytics Summary',
      official_transcript: 'Official Transcript',
    },
    generated: 'Generated at',
    filters: 'Applied filters',
    none: 'None',
    term: 'Term',
    course: 'Course',
    section: 'Section',
    cohort: 'Cohort',
    metric: 'Metric',
    value: 'Value',
    students: 'Students',
    records: 'Records',
    credits: 'Credits',
    averageScore: 'Average score',
    outcome: 'Outcome',
    count: 'Count',
    activeAssignments: 'Active assignments',
    checkpoints: 'Checkpoints',
    completionRate: 'Completion rate',
    student: 'Student',
    termGpa: 'Term GPA',
    cumulativeGpa: 'Cumulative GPA',
    code: 'Code',
    courseName: 'Course name',
    grade: 'Grade',
    noRecords: 'No academic records',
  },
  id: {
    titles: {
      institutional_academic_summary: 'Ringkasan Akademik Institusi',
      analytics_summary: 'Ringkasan Analitik',
      official_transcript: 'Transkrip Resmi',
    },
    generated: 'Dibuat pada',
    filters: 'Filter diterapkan',
    none: 'Tidak ada',
    term: 'Periode',
    course: 'Mata kuliah',
    section: 'Kelas',
    cohort: 'Angkatan',
    metric: 'Metrik',
    value: 'Nilai',
    students: 'Mahasiswa',
    records: 'Rekaman',
    credits: 'SKS',
    averageScore: 'Nilai rata-rata',
    outcome: 'Hasil',
    count: 'Jumlah',
    activeAssignments: 'Tugas aktif',
    checkpoints: 'Checkpoint',
    completionRate: 'Tingkat penyelesaian',
    student: 'Mahasiswa',
    termGpa: 'IP Semester',
    cumulativeGpa: 'IPK Kumulatif',
    code: 'Kode',
    courseName: 'Nama mata kuliah',
    grade: 'Nilai',
    noRecords: 'Tidak ada rekaman akademik',
  },
} as const;

type Copy = (typeof COPY)[ReportLocale];
type Cell = { text: string; width: number; align?: 'left' | 'right'; ellipsis?: boolean };

function text(doc: PDFKit.PDFDocument, value: string, options: PDFKit.Mixins.TextOptions = {}) {
  const content = doc.markStructureContent('P');
  doc.text(value, options);
  return content;
}

function heading(doc: PDFKit.PDFDocument, value: string, level: 1 | 2) {
  const content = doc.markStructureContent(`H${level}`);
  doc
    .font('Bold')
    .fontSize(level === 1 ? 18 : 11)
    .fillColor('#172033')
    .text(value);
  doc.moveDown(level === 1 ? 0.35 : 0.2);
  return content;
}

function formatTimestamp(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function formatNumber(value: number | null, digits = 2) {
  if (value === null) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function filterSummary(filters: NormalizedReportFilters, copy: Copy) {
  const values = [
    filters.termId === null ? null : `${copy.term}: ${filters.termId}`,
    filters.courseId === null ? null : `${copy.course}: ${filters.courseId}`,
    filters.sectionId === null ? null : `${copy.section}: ${filters.sectionId}`,
    filters.cohort === null ? null : `${copy.cohort}: ${filters.cohort}`,
  ].filter((value): value is string => value !== null);
  return values.length ? values.join(' | ') : copy.none;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number, tableHeader?: () => void) {
  if (doc.y + height <= BOTTOM_LIMIT) return;
  doc.addPage();
  tableHeader?.();
}

function tableRowHeight(doc: PDFKit.PDFDocument, cells: Cell[], bold = false) {
  const padding = 4;
  doc.font(bold ? 'Bold' : 'Regular').fontSize(8);
  const heights = cells.map((cell) =>
    doc.heightOfString(cell.text, { width: cell.width - padding * 2, lineGap: 1 }),
  );
  return Math.max(20, ...heights.map((value) => value + padding * 2));
}

function tableRow(doc: PDFKit.PDFDocument, cells: Cell[], bold = false) {
  const padding = 4;
  const height = tableRowHeight(doc, cells, bold);
  const startX = MARGIN;
  const startY = doc.y;
  let x = startX;
  doc
    .font(bold ? 'Bold' : 'Regular')
    .fontSize(8)
    .fillColor('#172033');
  for (const cell of cells) {
    doc.rect(x, startY, cell.width, height).strokeColor('#CBD2DC').lineWidth(0.5).stroke();
    doc.text(cell.text, x + padding, startY + padding, {
      width: cell.width - padding * 2,
      height: height - padding * 2,
      lineGap: 1,
      align: cell.align,
      ellipsis: cell.ellipsis ?? true,
    });
    x += cell.width;
  }
  doc.y = startY + height;
  doc.x = startX;
  return Math.max(height, 11);
}

function ensureSpaceForRow(doc: PDFKit.PDFDocument, cells: Cell[], tableHeader?: () => void) {
  ensureSpace(doc, tableRowHeight(doc, cells), tableHeader);
}

function renderInstitutional(
  doc: PDFKit.PDFDocument,
  request: Extract<ReportPdfRequest, { type: 'institutional_academic_summary' }>,
  copy: Copy,
) {
  heading(doc, copy.metric, 2);
  const metricHeader = () =>
    tableRow(
      doc,
      [
        { text: copy.metric, width: 330 },
        { text: copy.value, width: 181, align: 'right' },
      ],
      true,
    );
  metricHeader();
  const metrics = [
    [copy.students, request.data.totals.students],
    [copy.records, request.data.totals.records],
    [copy.credits, request.data.totals.credits],
    [copy.averageScore, request.data.totals.averageScore],
  ] as const;
  for (const [label, value] of metrics) {
    ensureSpaceForRow(
      doc,
      [
        { text: label, width: 330 },
        { text: formatNumber(value), width: 181, align: 'right' },
      ],
      metricHeader,
    );
    tableRow(doc, [
      { text: label, width: 330 },
      { text: formatNumber(value), width: 181, align: 'right' },
    ]);
  }
  doc.moveDown();
  heading(doc, copy.outcome, 2);
  const outcomeHeader = () =>
    tableRow(
      doc,
      [
        { text: copy.outcome, width: 330 },
        { text: copy.count, width: 181, align: 'right' },
      ],
      true,
    );
  outcomeHeader();
  for (const outcome of [...request.data.outcomes].sort((a, b) =>
    a.status.localeCompare(b.status),
  )) {
    ensureSpaceForRow(
      doc,
      [
        { text: outcome.status, width: 330 },
        { text: String(outcome.count), width: 181, align: 'right' },
      ],
      outcomeHeader,
    );
    tableRow(doc, [
      { text: outcome.status, width: 330 },
      { text: String(outcome.count), width: 181, align: 'right' },
    ]);
  }
}

function renderAnalytics(
  doc: PDFKit.PDFDocument,
  request: Extract<ReportPdfRequest, { type: 'analytics_summary' }>,
  copy: Copy,
) {
  heading(doc, copy.section, 2);
  const widths = [191, 70, 90, 90, 70];
  const header = () =>
    tableRow(
      doc,
      [
        { text: copy.section, width: widths[0] },
        { text: copy.students, width: widths[1], align: 'right' },
        { text: copy.activeAssignments, width: widths[2], align: 'right' },
        { text: copy.checkpoints, width: widths[3], align: 'right' },
        { text: copy.completionRate, width: widths[4], align: 'right' },
      ],
      true,
    );
  header();
  const sections = [...request.data.sections].sort(
    (a, b) => a.sectionCode.localeCompare(b.sectionCode) || a.sectionId - b.sectionId,
  );
  for (const section of sections) {
    ensureSpaceForRow(
      doc,
      [
        { text: section.sectionCode, width: widths[0] },
        { text: String(section.students), width: widths[1], align: 'right' },
        { text: String(section.activeAssignments), width: widths[2], align: 'right' },
        {
          text: `${section.passedCheckpoints}/${section.totalCheckpoints}`,
          width: widths[3],
          align: 'right',
        },
        { text: `${section.completionRate}%`, width: widths[4], align: 'right' },
      ],
      header,
    );
    tableRow(doc, [
      { text: section.sectionCode, width: widths[0] },
      { text: String(section.students), width: widths[1], align: 'right' },
      { text: String(section.activeAssignments), width: widths[2], align: 'right' },
      {
        text: `${section.passedCheckpoints}/${section.totalCheckpoints}`,
        width: widths[3],
        align: 'right',
      },
      { text: `${section.completionRate}%`, width: widths[4], align: 'right' },
    ]);
  }
}

function renderTranscript(
  doc: PDFKit.PDFDocument,
  request: Extract<ReportPdfRequest, { type: 'official_transcript' }>,
  copy: Copy,
) {
  doc.font('Regular').fontSize(9);
  text(doc, `${copy.student}: ${request.data.student.name}`);
  text(doc, `${copy.termGpa}: ${formatNumber(request.data.termGpa?.gpa ?? null)}`);
  text(doc, `${copy.cumulativeGpa}: ${formatNumber(request.data.cumulativeGpa?.gpa ?? null)}`);
  doc.moveDown(0.7);
  const widths = [65, 221, 85, 55, 40, 45];
  const header = () =>
    tableRow(
      doc,
      [
        { text: copy.code, width: widths[0] },
        { text: copy.courseName, width: widths[1] },
        { text: copy.term, width: widths[2] },
        { text: copy.grade, width: widths[3] },
        { text: copy.credits, width: widths[4], align: 'right' },
        { text: copy.value, width: widths[5], align: 'right' },
      ],
      true,
    );
  header();
  const records = [...request.data.records].sort(
    (a, b) =>
      b.termCode.localeCompare(a.termCode) ||
      a.courseCode.localeCompare(b.courseCode) ||
      b.recordId - a.recordId,
  );
  if (records.length === 0) {
    doc.font('Regular').fontSize(8).fillColor('#5B6472');
    text(doc, copy.noRecords);
    doc.moveDown(0.7);
    return;
  }
  for (const record of records) {
    const cells: Cell[] = [
      { text: record.courseCode, width: widths[0] },
      { text: record.courseName, width: widths[1], ellipsis: false },
      { text: record.termCode, width: widths[2] },
      { text: record.letterGrade ?? '-', width: widths[3] },
      { text: formatNumber(record.credits), width: widths[4], align: 'right' },
      { text: formatNumber(record.numericScore), width: widths[5], align: 'right' },
    ];
    ensureSpaceForRow(doc, cells, header);
    tableRow(doc, cells);
  }
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#5B6472')
      .text(`${index + 1} / ${range.count}`, MARGIN, BOTTOM_LIMIT - 20, {
        width: CONTENT_WIDTH,
        align: 'center',
        lineBreak: false,
      });
  }
}

export function renderReportPdf(request: ReportPdfRequest): Promise<Buffer> {
  const copy = COPY[request.locale];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, right: MARGIN, bottom: 58, left: MARGIN },
    font: null as unknown as string,
    bufferPages: true,
    tagged: true,
    displayTitle: true,
    info: {
      Title: copy.titles[request.type],
      Author: request.institution.name,
      Subject: copy.titles[request.type],
      CreationDate: request.generatedAt,
    },
    lang: request.locale === 'id' ? 'id-ID' : 'en-US',
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.registerFont('Regular', REGULAR_FONT);
  doc.registerFont('Bold', BOLD_FONT);
  doc.font('Bold').fontSize(12).fillColor('#172033');
  heading(doc, request.institution.name, 2);
  if (request.institution.address) {
    doc.font('Regular').fontSize(8).fillColor('#5B6472');
    text(doc, request.institution.address);
  }
  doc.moveDown(0.7);
  heading(doc, copy.titles[request.type], 1);
  doc.font('Regular').fontSize(8).fillColor('#414A58');
  text(doc, `${copy.generated}: ${formatTimestamp(request.generatedAt)}`);
  text(doc, `${copy.filters}: ${filterSummary(request.filters, copy)}`);
  doc.moveDown();

  if (request.type === 'institutional_academic_summary') renderInstitutional(doc, request, copy);
  if (request.type === 'analytics_summary') renderAnalytics(doc, request, copy);
  if (request.type === 'official_transcript') renderTranscript(doc, request, copy);
  addPageNumbers(doc);

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
