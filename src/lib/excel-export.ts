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
