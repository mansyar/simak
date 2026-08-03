import { isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignmentTemplates } from '../db/schema/templates';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '../lib/errors';
import type { z } from 'zod';
import type { ListTemplateTypesSchema } from './templates';

type ListTemplateTypesInput = z.infer<typeof ListTemplateTypesSchema>;

function isInstructorOrAdmin(session: Awaited<ReturnType<typeof getSessionFromHeaders>>) {
  return (
    !!session &&
    (session.user.role === 'admin' ||
      session.user.role === 'superadmin' ||
      session.user.role === 'instructor')
  );
}

export async function listTemplateTypesHandler({ data: _data }: { data: ListTemplateTypesInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructorOrAdmin(session)) {
    return { types: [] };
  }

  const db = getDb();
  try {
    const rows = await db
      .select({ type: assignmentTemplates.type })
      .from(assignmentTemplates)
      .where(isNull(assignmentTemplates.deletedAt))
      .groupBy(assignmentTemplates.type);

    return { types: rows.map((row) => row.type) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listTemplateTypesHandler',
    });
  }
}
