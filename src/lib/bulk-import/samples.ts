import { utils, write } from 'xlsx';

/**
 * Generate a sample .xlsx file for bulk user import.
 * Contains headers (name, email, role) + one example row.
 * Output is a Blob (client-side only, no server round-trip).
 */
export function generateUserSampleXlsx(): Blob {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([
    ['name', 'email', 'role'],
    ['John Doe', 'john.doe@example.com', 'student'],
  ]);
  utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate a sample .xlsx file for bulk template import.
 * Contains headers (templateName, type, checkpointName, minConsultations, estimatedDuration)
 * + example checkpoint rows for one template.
 * Output is a Blob (client-side only, no server round-trip).
 */
export function generateTemplateSampleXlsx(): Blob {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([
    ['templateName', 'type', 'checkpointName', 'minConsultations', 'estimatedDuration'],
    ['Assignment Template', 'Assignment', 'Research Phase', '0', '14'],
    ['Assignment Template', 'Assignment', 'Draft Submission', '2', '7'],
    ['Assignment Template', 'Assignment', 'Final Submission', '5', '7'],
  ]);
  utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
