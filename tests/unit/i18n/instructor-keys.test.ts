import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';

/**
 * Regression test: ensures every new i18n key added by the
 * "UI consistency for instructor facing UI" track is present in both locales.
 */

const REQUIRED_KEYS = [
  // Task: wizard validation errors
  'instructorAssignments.wizard.errors.templateRequired',
  'instructorAssignments.wizard.errors.titleRequired',
  'instructorAssignments.wizard.errors.titleMinLength',
  'instructorAssignments.wizard.errors.deadlineRequired',
  'instructorAssignments.wizard.errors.deadlineInvalid',
  'instructorAssignments.wizard.errors.deadlineInPast',
  'instructorAssignments.wizard.errors.studentsRequired',
  'instructorAssignments.wizard.errors.dueDatesInPast',
  'instructorAssignments.wizard.errors.submitFailed',
  'instructorAssignments.wizard.errors.networkError',
  // Task: ReviewForm upload errors
  'instructorReviews.errors.feedbackUploadFailed',
  // Task: ReviewHistory labelled date
  'instructorReviews.reviewDateLabel',
  // Task: pagination pageOf
  'common.pageOf',
  // Task: totalStudents split
  'instructorAssignments.details.totalStudents',
  // Task: consultations description
  'consultations.noPendingConsultationsDescription',
];

function getValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

describe('Instructor UI track i18n keys', () => {
  it.each(REQUIRED_KEYS)('key "%s" exists in en.json', (key) => {
    expect(getValue(en, key)).toBeDefined();
  });

  it.each(REQUIRED_KEYS)('key "%s" exists in id.json', (key) => {
    expect(getValue(id, key)).toBeDefined();
  });
});
