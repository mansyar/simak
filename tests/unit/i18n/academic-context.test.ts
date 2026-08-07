import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type Locale = Record<string, unknown>;

function readLocale(path: string): Locale {
  return JSON.parse(readFileSync(path, 'utf8')) as Locale;
}

function hasKey(locale: Locale, key: string): boolean {
  return (
    key.split('.').reduce<unknown>((value, part) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[part];
    }, locale) !== undefined
  );
}

const requiredKeys = [
  'adminAcademicContext.title',
  'adminAcademicContext.terms',
  'adminAcademicContext.courses',
  'adminAcademicContext.sections',
  'adminAcademicContext.enrollments',
  'adminAcademicContext.actions.createTerm',
  'adminAcademicContext.actions.createCourse',
  'adminAcademicContext.actions.createSection',
  'adminAcademicContext.actions.archive',
  'adminAcademicContext.empty',
  'adminAcademicContext.archiveConfirm',
  'adminAcademicContext.forms.termCode',
  'adminAcademicContext.forms.submit',
  'adminAcademicContext.roles.student',
  'instructorAssignments.context.section',
  'instructorAssignments.context.selectSection',
  'instructorAssignments.context.students',
  'instructorAssignments.context.mode',
  'instructorAssignments.context.status',
  'instructorAssignments.mode.individual',
  'instructorAssignments.status.active',
  'instructorAssignments.actions.clone',
  'instructorAssignments.actions.rollover',
  'studentAssignments.context.term',
  'studentAssignments.context.course',
  'studentAssignments.context.section',
  'studentAssignments.status.draft',
  'studentAssignments.status.active',
  'studentAssignments.status.archived',
];

describe('academic-context i18n contract', () => {
  it('defines every new key in English and Indonesian locales', () => {
    const en = readLocale('locales/en.json');
    const id = readLocale('locales/id.json');

    for (const key of requiredKeys) {
      expect(hasKey(en, key), `missing English key: ${key}`).toBe(true);
      expect(hasKey(id, key), `missing Indonesian key: ${key}`).toBe(true);
    }
  });
});
