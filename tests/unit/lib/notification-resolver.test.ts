/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { resolveNotificationContent } from '@/server/notifications.server';

describe('resolveNotificationContent', () => {
  it('returns English strings for the en locale', () => {
    const result = resolveNotificationContent(
      'notifications.events.review_completed.title',
      'notifications.events.review_completed.message',
      { checkpointName: 'Draft', assignmentTitle: 'Essay' },
      'en',
    );

    expect(result.title).toBe('Review Completed');
    expect(result.message).toBe('The review for checkpoint "Draft" in "Essay" has been completed.');
  });

  it('returns Indonesian strings for the id locale', () => {
    const result = resolveNotificationContent(
      'notifications.events.review_completed.title',
      'notifications.events.review_completed.message',
      { checkpointName: 'Draft', assignmentTitle: 'Essay' },
      'id',
    );

    expect(result.title).toBe('Ulasan Selesai');
    expect(result.message).toBe('Ulasan untuk checkpoint "Draft" di "Essay" telah selesai.');
  });

  it('interpolates missing params with placeholders', () => {
    const result = resolveNotificationContent(
      'notifications.events.submission_received.title',
      'notifications.events.submission_received.message',
      {},
      'en',
    );

    expect(result.title).toBe('New Submission Received');
    expect(result.message).toBe('{studentName} submitted work for "{assignmentTitle}".');
  });

  it('falls back to the raw key when a translation is missing', () => {
    const result = resolveNotificationContent(
      'notifications.events.unknown_event.title',
      'notifications.events.unknown_event.message',
      {},
      'en',
    );

    expect(result.title).toBe('notifications.events.unknown_event.title');
    expect(result.message).toBe('notifications.events.unknown_event.message');
  });
});
