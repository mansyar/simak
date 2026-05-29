import { describe, it, expect } from 'vitest';

describe('Drizzle ORM relations', () => {
  it('should export all relation constants from schema barrel', async () => {
    const mod = await import('@/db/schema/index');

    const expectedRelations = [
      'usersRelations',
      'sessionRelations',
      'accountRelations',
      'verificationRelations',
      'assignmentTemplatesRelations',
      'templateCheckpointsRelations',
      'assignmentsRelations',
      'assignmentStudentsRelations',
      'checkpointsRelations',
      'submissionsRelations',
      'reviewsRelations',
      'consultationsRelations',
      'notificationsRelations',
      'extensionRequestsRelations',
    ];

    for (const rel of expectedRelations) {
      expect(mod).toHaveProperty(rel);
    }
  });

  it('should re-export all tables from schema barrel', async () => {
    const mod = await import('@/db/schema/index');

    const expectedTables = [
      'users',
      'session',
      'account',
      'verification',
      'assignmentTemplates',
      'templateCheckpoints',
      'assignments',
      'assignmentStudents',
      'checkpoints',
      'submissions',
      'reviews',
      'consultations',
      'notifications',
      'extensionRequests',
    ];

    for (const table of expectedTables) {
      expect(mod).toHaveProperty(table);
    }
  });
});
