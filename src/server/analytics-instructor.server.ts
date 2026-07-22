// Server-only handler for instructor analytics data
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';

type AnalyticsDateRangeInput = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: Date;
  end?: Date;
};

export async function getInstructorAnalyticsDataHandler(_: { data: AnalyticsDateRangeInput }) {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}
