import { utils, write } from 'xlsx';

/**
 * Exports an array of JSON objects as an .xlsx file.
 * Creates a workbook with a single sheet and triggers a client-side download.
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
): void {
  const wb = utils.book_new();
  const ws = utils.json_to_sheet(data);
  utils.book_append_sheet(wb, ws, sheetName);
  const buf = write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface RubricScoreExportRow {
  studentName: string;
  checkpointName: string;
  criterionTitle: string;
  score: number;
  weight: number;
  levelLabel: string | null;
  comment: string | null;
}

/**
 * Sanitizes a string cell value to prevent formula injection in spreadsheet apps.
 * Prefixes dangerous characters (=, +, -, @, tab, CR) with a single quote,
 * matching the CSV export's escapeCsvValue mitigation.
 */
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Exports per-student rubric criterion scores as an .xlsx file.
 * Maps the rubric score data to human-readable column headers.
 * String fields are sanitized to prevent formula injection (CWE-1236).
 */
export function exportRubricScoresToExcel(data: RubricScoreExportRow[], fileName: string): void {
  const rows = data.map((r) => ({
    Student: sanitizeCell(r.studentName),
    Checkpoint: sanitizeCell(r.checkpointName),
    Criterion: sanitizeCell(r.criterionTitle),
    Score: r.score,
    Weight: r.weight,
    Level: r.levelLabel ? sanitizeCell(r.levelLabel) : '',
    Comment: r.comment ? sanitizeCell(r.comment) : '',
  }));
  exportToExcel(rows, 'Rubric Scores', fileName);
}

/**
 * Exports the gradebook for an assignment as an .xlsx file.
 * Fetches gradebook data via server function, maps to human-readable
 * columns (Student Name, checkpoint scores, Final Score, Letter Grade, Status),
 * and triggers a client-side download. String fields are sanitized via sanitizeCell.
 */
export async function exportGradebookToExcel(assignmentId: number): Promise<void> {
  const { getAssignmentGradebook } = await import('@/server/gradebook');
  const { isServerError } = await import('@/lib/errors');
  const result = await getAssignmentGradebook({ data: { assignmentId } });
  if (isServerError(result)) return;

  const { students } = result;
  const checkpointCols = new Map<string, number>();
  for (const s of students) {
    for (const cp of s.finalGrade?.contributingCheckpoints ?? []) {
      if (!checkpointCols.has(cp.checkpointName)) {
        checkpointCols.set(cp.checkpointName, cp.order);
      }
    }
  }
  const sortedCols = Array.from(checkpointCols.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => name);

  const rows = students.map((s) => {
    const row: Record<string, string | number> = {
      'Student Name': sanitizeCell(s.studentName),
    };
    const scoreMap = new Map(
      (s.finalGrade?.contributingCheckpoints ?? []).map((cp) => [cp.checkpointName, cp.score]),
    );
    for (const col of sortedCols) {
      row[col] = scoreMap.get(col) ?? '';
    }
    row['Final Score'] = s.finalGrade?.numericScore ?? '';
    row['Letter Grade'] = s.finalGrade?.letterGrade ?? '';
    row['Status'] = s.finalGrade?.status ?? '';
    return row;
  });

  exportToExcel(rows, 'Gradebook', `gradebook-${assignmentId}.xlsx`);
}
