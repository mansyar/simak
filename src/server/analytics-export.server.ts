// CSV export handler implementations (server-only, never client-bundled)
import { serverError, ErrorCode } from '../lib/errors';

export type ExportUsersCsvInput = Record<string, never>;
export type ExportAuditLogCsvInput = { dateFrom?: string; dateTo?: string };
export type ExportAssignmentProgressCsvInput = Record<string, never>;
export type ExportStudentProgressCsvInput = { assignmentId: number };
export type ExportReviewHistoryCsvInput = { assignmentId: number };

export async function exportUsersCsvHandler({ data }: { data: ExportUsersCsvInput }) {
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}

export async function exportAuditLogCsvHandler({ data }: { data: ExportAuditLogCsvInput }) {
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}

export async function exportAssignmentProgressCsvHandler({
  data,
}: {
  data: ExportAssignmentProgressCsvInput;
}) {
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}

export async function exportStudentProgressCsvHandler({
  data,
}: {
  data: ExportStudentProgressCsvInput;
}) {
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}

export async function exportReviewHistoryCsvHandler({
  data,
}: {
  data: ExportReviewHistoryCsvInput;
}) {
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}
