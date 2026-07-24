import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { read, utils } from 'xlsx';

describe('exportToExcel', () => {
  let capturedBlob: Blob | null = null;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedBlob = null;
    clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});

    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob;
      return 'mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function readCapturedBlob() {
    if (!capturedBlob) throw new Error('No blob was captured');
    const buf = Buffer.from(await capturedBlob.arrayBuffer());
    return read(buf, { type: 'buffer' });
  }

  it('should create a valid .xlsx blob with correct MIME type', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');
    exportToExcel([{ name: 'Test' }], 'Sheet1', 'test.xlsx');

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('should create a workbook with the specified sheet name', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');
    exportToExcel([{ name: 'Test' }], 'Analytics', 'analytics.xlsx');

    const wb = await readCapturedBlob();
    expect(wb.SheetNames).toEqual(['Analytics']);
  });

  it('should write JSON data as rows in the sheet', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');
    const data = [
      { name: 'John', age: 30, role: 'admin' },
      { name: 'Jane', age: 25, role: 'student' },
    ];
    exportToExcel(data, 'Users', 'users.xlsx');

    const wb = await readCapturedBlob();
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ name: 'John', age: 30, role: 'admin' });
    expect(rows[1]).toEqual({ name: 'Jane', age: 25, role: 'student' });
  });

  it('should trigger download via createObjectURL, anchor click, and revokeObjectURL', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    exportToExcel([{ name: 'Test' }], 'Sheet1', 'test.xlsx');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');

    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.getAttribute('href')).toBe('mock-url');
    expect(anchor.download).toBe('test.xlsx');
  });

  it('should handle empty data array gracefully', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');
    exportToExcel([], 'Empty', 'empty.xlsx');

    expect(capturedBlob).not.toBeNull();
    const wb = await readCapturedBlob();
    expect(wb.SheetNames).toEqual(['Empty']);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json(ws);
    expect(rows.length).toBe(0);
  });

  it('should handle a single data row', async () => {
    const { exportToExcel } = await import('@/lib/excel-export');
    const data = [{ metric: 'Reviews', value: 42 }];
    exportToExcel(data, 'Metrics', 'metrics.xlsx');

    const wb = await readCapturedBlob();
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual({ metric: 'Reviews', value: 42 });
  });

  it('should export rubric score rows with correct columns via exportRubricScoresToExcel', async () => {
    const { exportRubricScoresToExcel } = await import('@/lib/excel-export');
    const data = [
      {
        studentName: 'John Doe',
        checkpointName: 'Proposal Review',
        criterionTitle: 'Technical Quality',
        score: 85,
        weight: 50,
        levelLabel: null,
        comment: 'Good work',
      },
      {
        studentName: 'Jane Smith',
        checkpointName: 'Proposal Review',
        criterionTitle: 'Technical Quality',
        score: 70,
        weight: 50,
        levelLabel: 'Good',
        comment: null,
      },
    ];
    exportRubricScoresToExcel(data, 'rubric-scores.xlsx');

    expect(capturedBlob).not.toBeNull();
    const wb = await readCapturedBlob();
    expect(wb.SheetNames).toEqual(['Rubric Scores']);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({
      Student: 'John Doe',
      Checkpoint: 'Proposal Review',
      Criterion: 'Technical Quality',
      Score: 85,
      Weight: 50,
      Level: '',
      Comment: 'Good work',
    });
    expect(rows[1]).toEqual({
      Student: 'Jane Smith',
      Checkpoint: 'Proposal Review',
      Criterion: 'Technical Quality',
      Score: 70,
      Weight: 50,
      Level: 'Good',
      Comment: '',
    });
  });

  it('should handle empty rubric score data via exportRubricScoresToExcel', async () => {
    const { exportRubricScoresToExcel } = await import('@/lib/excel-export');
    exportRubricScoresToExcel([], 'empty-rubric.xlsx');

    expect(capturedBlob).not.toBeNull();
    const wb = await readCapturedBlob();
    expect(wb.SheetNames).toEqual(['Rubric Scores']);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json(ws);
    expect(rows.length).toBe(0);
  });
});
