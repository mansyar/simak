// Server-only handler for admin analytics data
// Full implementation in Task 3 — this is a placeholder for type resolution
import { serverError, ErrorCode } from '@/lib/errors';

type AnalyticsDateRangeInput = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: Date;
  end?: Date;
};

export async function getAdminAnalyticsDataHandler({ data }: { data: AnalyticsDateRangeInput }) {
  // TODO: Implement analytics queries in Task 3
  void data;
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}
