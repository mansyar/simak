import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';

describe('Discussion i18n keys', () => {
  describe('notifications.events.discussion_reply', () => {
    it('should have title and message in en.json', () => {
      const event = en as Record<string, unknown> as {
        notifications?: { events?: { discussion_reply?: { title?: string; message?: string } } };
      };
      expect(event.notifications?.events?.discussion_reply?.title).toBeDefined();
      expect(event.notifications?.events?.discussion_reply?.message).toBeDefined();
    });

    it('should have title and message in id.json', () => {
      const event = id as Record<string, unknown> as {
        notifications?: { events?: { discussion_reply?: { title?: string; message?: string } } };
      };
      expect(event.notifications?.events?.discussion_reply?.title).toBeDefined();
      expect(event.notifications?.events?.discussion_reply?.message).toBeDefined();
    });

    it('should include authorName, checkpointName, assignmentTitle, messagePreview params in EN message', () => {
      const event = en as Record<string, unknown> as {
        notifications?: { events?: { discussion_reply?: { message?: string } } };
      };
      const message = event.notifications?.events?.discussion_reply?.message;
      expect(message).toContain('{authorName}');
      expect(message).toContain('{checkpointName}');
      expect(message).toContain('{assignmentTitle}');
      expect(message).toContain('{messagePreview}');
    });

    it('should include authorName, checkpointName, assignmentTitle, messagePreview params in ID message', () => {
      const event = id as Record<string, unknown> as {
        notifications?: { events?: { discussion_reply?: { message?: string } } };
      };
      const message = event.notifications?.events?.discussion_reply?.message;
      expect(message).toContain('{authorName}');
      expect(message).toContain('{checkpointName}');
      expect(message).toContain('{assignmentTitle}');
      expect(message).toContain('{messagePreview}');
    });
  });

  describe('emails.subjects.discussionReply', () => {
    it('should exist in en.json', () => {
      const subjects = en as Record<string, unknown> as {
        emails?: { subjects?: { discussionReply?: string } };
      };
      expect(subjects.emails?.subjects?.discussionReply).toBeDefined();
      expect(typeof subjects.emails?.subjects?.discussionReply).toBe('string');
    });

    it('should exist in id.json', () => {
      const subjects = id as Record<string, unknown> as {
        emails?: { subjects?: { discussionReply?: string } };
      };
      expect(subjects.emails?.subjects?.discussionReply).toBeDefined();
      expect(typeof subjects.emails?.subjects?.discussionReply).toBe('string');
    });
  });
});
