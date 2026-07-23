// Server-only helpers (not imported by client code)
import { eq, inArray, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignmentTemplates, templateCheckpoints } from '../db/schema/templates';
import { assignments, assignmentStudents } from '../db/schema/assignments';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { syncTemplateCheckpoints } from './template-checkpoint-sync.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesSchema,
  TemplateIdParamSchema,
  ListTemplateAssignmentsSchema,
} from './templates';
type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
type ListTemplatesInput = z.infer<typeof ListTemplatesSchema>;
type TemplateIdParam = z.infer<typeof TemplateIdParamSchema>;
type ListTemplateAssignmentsInput = z.infer<typeof ListTemplateAssignmentsSchema>;
function isAdmin(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && (session.user.role === 'admin' || session.user.role === 'superadmin');
}
function isInstructorOrAdmin(session: NonNullableSession | null): session is NonNullableSession {
  return (
    !!session &&
    (session.user.role === 'admin' ||
      session.user.role === 'superadmin' ||
      session.user.role === 'instructor')
  );
}
export async function listTemplatesHandler(args: { data: ListTemplatesInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructorOrAdmin(session)) {
    return { templates: [], total: 0, allTypes: [] };
  }

  const { search, type, page, limit } = args.data;
  const db = getDb();

  try {
    const conditions = [isNull(assignmentTemplates.deletedAt)];

    if (search) {
      conditions.push(sql`${assignmentTemplates.name} ILIKE ${'%' + search + '%'}`);
    }

    if (type) {
      conditions.push(eq(assignmentTemplates.type, type));
    }

    const [templatesData, [{ count }], typeRows] = await Promise.all([
      db
        .select({
          id: assignmentTemplates.id,
          name: assignmentTemplates.name,
          type: assignmentTemplates.type,
          createdBy: assignmentTemplates.createdBy,
          createdAt: assignmentTemplates.createdAt,
          updatedAt: assignmentTemplates.updatedAt,
        })
        .from(assignmentTemplates)
        .where(and(...conditions))
        .orderBy(assignmentTemplates.createdAt)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignmentTemplates)
        .where(and(...conditions)),
      db
        .select({ type: assignmentTemplates.type })
        .from(assignmentTemplates)
        .where(isNull(assignmentTemplates.deletedAt))
        .groupBy(assignmentTemplates.type),
    ]);

    // Enrich with checkpoints and counts in a separate query
    const templateIds = templatesData.map((t) => t.id);
    let checkpointCounts: Map<number, number> = new Map();
    const checkpointsMap: Map<number, string[]> = new Map();

    if (templateIds.length > 0) {
      const counts = await db
        .select({
          templateId: templateCheckpoints.templateId,
          count: sql<number>`count(*)::int`,
        })
        .from(templateCheckpoints)
        .where(
          and(
            inArray(templateCheckpoints.templateId, templateIds),
            isNull(templateCheckpoints.deletedAt),
          ),
        )
        .groupBy(templateCheckpoints.templateId);

      checkpointCounts = new Map(counts.map((c) => [c.templateId, Number(c.count)]));

      const allCheckpoints = await db
        .select({
          templateId: templateCheckpoints.templateId,
          name: templateCheckpoints.name,
        })
        .from(templateCheckpoints)
        .where(
          and(
            inArray(templateCheckpoints.templateId, templateIds),
            isNull(templateCheckpoints.deletedAt),
          ),
        )
        .orderBy(templateCheckpoints.order);

      allCheckpoints.forEach((cp) => {
        const list = checkpointsMap.get(cp.templateId) ?? [];
        list.push(cp.name);
        checkpointsMap.set(cp.templateId, list);
      });
    }

    const templatesWithCounts = templatesData.map((t) => ({
      ...t,
      checkpointCount: checkpointCounts.get(t.id) ?? 0,
      checkpoints: checkpointsMap.get(t.id) ?? [],
    }));

    return {
      templates: templatesWithCounts,
      total: Number(count),
      allTypes: typeRows.map((r) => r.type),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listTemplatesHandler',
    });
  }
}
export async function getTemplateHandler(args: { data: TemplateIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isInstructorOrAdmin(session)) {
    return null;
  }

  const db = getDb();
  const { id } = args.data;

  try {
    const [template] = await db
      .select({
        id: assignmentTemplates.id,
        name: assignmentTemplates.name,
        type: assignmentTemplates.type,
        createdBy: assignmentTemplates.createdBy,
        createdByName: users.name,
        createdAt: assignmentTemplates.createdAt,
        updatedAt: assignmentTemplates.updatedAt,
      })
      .from(assignmentTemplates)
      .leftJoin(users, eq(assignmentTemplates.createdBy, users.id))
      .where(and(eq(assignmentTemplates.id, id), isNull(assignmentTemplates.deletedAt)))
      .limit(1);

    if (!template) {
      return null;
    }

    // Get active assignment count for in-use banner
    const [{ assignmentCount }] = await db
      .select({ assignmentCount: sql<number>`count(*)::int` })
      .from(assignments)
      .where(and(eq(assignments.templateId, id), isNull(assignments.deletedAt)));

    const checkpoints = await db
      .select({
        id: templateCheckpoints.id,
        name: templateCheckpoints.name,
        order: templateCheckpoints.order,
        minConsultations: templateCheckpoints.minConsultations,
        estimatedDuration: templateCheckpoints.estimatedDuration,
      })
      .from(templateCheckpoints)
      .where(and(eq(templateCheckpoints.templateId, id), isNull(templateCheckpoints.deletedAt)))
      .orderBy(templateCheckpoints.order);

    return { ...template, checkpoints, assignmentCount: Number(assignmentCount) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getTemplateHandler',
    });
  }
}
export async function createTemplateHandler(args: { data: CreateTemplateInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { name, type, checkpoints } = args.data;
  const db = getDb();

  try {
    const [inserted] = await db
      .insert(assignmentTemplates)
      .values({
        name,
        type,
        createdBy: session.user.id,
      })
      .returning({ id: assignmentTemplates.id })
      .then((rows) => rows);

    await logAuditEvent({
      actorId: session.user.id,
      action: 'template.created',
      entityType: 'template',
      entityId: inserted.id.toString(),
      details: { name, type, checkpointCount: checkpoints.length },
    });

    // Insert checkpoint rows with sequential order
    const checkpointRows = checkpoints.map((cp, index) => ({
      templateId: inserted.id,
      name: cp.name,
      order: index + 1,
      minConsultations: cp.minConsultations ?? 0,
      estimatedDuration: cp.estimatedDuration ?? 7,
    }));

    await db.insert(templateCheckpoints).values(checkpointRows);

    return {
      template: {
        id: inserted.id,
        name,
        type,
        createdBy: session.user.id,
        createdByName: (session.user as { name?: string | null }).name ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkpoints: checkpointRows.map((cp, index) => ({
          id: index + 1,
          name: cp.name,
          order: cp.order,
          minConsultations: cp.minConsultations ?? 0,
          estimatedDuration: cp.estimatedDuration ?? 7,
        })),
        assignmentCount: 0,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createTemplateHandler',
    });
  }
}
export async function updateTemplateHandler(args: { data: UpdateTemplateInput & { id: number } }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { id, name, type, checkpoints } = args.data;
  const db = getDb();

  try {
    await db
      .update(assignmentTemplates)
      .set({ name, type, updatedAt: new Date() })
      .where(eq(assignmentTemplates.id, id));

    await syncTemplateCheckpoints(db, id, checkpoints);

    await logAuditEvent({
      actorId: session.user.id,
      action: 'template.updated',
      entityType: 'template',
      entityId: id.toString(),
      details: { name, type, checkpointCount: checkpoints.length },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateTemplateHandler',
    });
  }
}
export async function deleteTemplateHandler(args: { data: TemplateIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const { id } = args.data;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignments)
      .where(and(eq(assignments.templateId, id), isNull(assignments.deletedAt)));

    if (Number(count) > 0) {
      return serverError(ErrorCode.BAD_REQUEST, 'in_use', { input: { count: Number(count) } });
    }

    // Soft-delete the template
    await db
      .update(assignmentTemplates)
      .set({ deletedAt: new Date() })
      .where(eq(assignmentTemplates.id, id));

    await logAuditEvent({
      actorId: session.user.id,
      action: 'template.deleted',
      entityType: 'template',
      entityId: id.toString(),
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'deleteTemplateHandler',
    });
  }
}
export async function duplicateTemplateHandler(args: { data: TemplateIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const { id } = args.data;

  try {
    const [original] = await db
      .select({
        id: assignmentTemplates.id,
        name: assignmentTemplates.name,
        type: assignmentTemplates.type,
        createdBy: assignmentTemplates.createdBy,
      })
      .from(assignmentTemplates)
      .where(and(eq(assignmentTemplates.id, id), isNull(assignmentTemplates.deletedAt)))
      .limit(1);

    if (!original) {
      return serverError(ErrorCode.NOT_FOUND, 'Template not found');
    }

    let newName = original.name;
    const copySuffix = ' (Copy)';
    if (newName.endsWith(copySuffix)) {
      // Already has (Copy), append number
      newName = `${newName} 2`;
    } else if (/\(Copy \d+\)$/.test(newName)) {
      // Has (Copy N), increment
      const match = newName.match(/\(Copy (\d+)\)$/);
      if (match) {
        newName = newName.replace(/\(Copy \d+\)$/, `(Copy ${parseInt(match[1]) + 1})`);
      }
    } else {
      newName = `${newName}${copySuffix}`;
    }

    const [inserted] = await db
      .insert(assignmentTemplates)
      .values({
        name: newName,
        type: original.type,
        createdBy: session.user.id,
      })
      .returning({ id: assignmentTemplates.id })
      .then((rows) => rows);

    const originalCheckpoints = await db
      .select({
        name: templateCheckpoints.name,
        order: templateCheckpoints.order,
        minConsultations: templateCheckpoints.minConsultations,
        estimatedDuration: templateCheckpoints.estimatedDuration,
      })
      .from(templateCheckpoints)
      .where(and(eq(templateCheckpoints.templateId, id), isNull(templateCheckpoints.deletedAt)))
      .orderBy(templateCheckpoints.order);

    const checkpointRows = originalCheckpoints.map((cp) => ({
      templateId: inserted.id,
      name: cp.name,
      order: cp.order,
      minConsultations: cp.minConsultations ?? 0,
      estimatedDuration: cp.estimatedDuration ?? 7,
    }));

    await db.insert(templateCheckpoints).values(checkpointRows);

    return {
      template: {
        id: inserted.id,
        name: newName,
        type: original.type,
        createdBy: session.user.id,
        createdByName: (session.user as { name?: string | null }).name ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkpoints: checkpointRows.map((cp, index) => ({
          id: index + 1,
          name: cp.name,
          order: cp.order,
          minConsultations: cp.minConsultations ?? 0,
          estimatedDuration: cp.estimatedDuration ?? 7,
        })),
        assignmentCount: 0,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'duplicateTemplateHandler',
    });
  }
}
export async function listTemplateAssignmentsHandler(args: { data: ListTemplateAssignmentsInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return { assignments: [], total: 0 };
  }

  const db = getDb();
  const { templateId, page = 1, limit = 20 } = args.data;

  try {
    const conditions = and(eq(assignments.templateId, templateId), isNull(assignments.deletedAt));

    const [templateAssignments, [{ count }]] = await Promise.all([
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          instructorName: users.name,
          createdAt: assignments.createdAt,
        })
        .from(assignments)
        .innerJoin(users, eq(assignments.instructorId, users.id))
        .where(conditions)
        .orderBy(assignments.createdAt)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignments)
        .where(conditions),
    ]);

    const assignmentIds = templateAssignments.map((a) => a.id);
    let studentCounts: Map<number, number> = new Map();

    if (assignmentIds.length > 0) {
      const counts = await db
        .select({
          assignmentId: assignmentStudents.assignmentId,
          count: sql<number>`count(*)::int`,
        })
        .from(assignmentStudents)
        .where(inArray(assignmentStudents.assignmentId, assignmentIds))
        .groupBy(assignmentStudents.assignmentId);

      studentCounts = new Map(counts.map((c) => [c.assignmentId, Number(c.count)]));
    }

    return {
      assignments: templateAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        instructorName: a.instructorName,
        studentCount: studentCounts.get(a.id) ?? 0,
        createdAt: a.createdAt,
      })),
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listTemplateAssignmentsHandler',
    });
  }
}
