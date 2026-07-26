import { describe, it, expect } from 'vitest';
import {
  notificationKeys,
  consultationKeys,
  extensionKeys,
  assignmentKeys,
  userKeys,
  templateKeys,
  discussionKeys,
  settingsKeys,
  gradebookKeys,
} from '@/lib/query-keys';

describe('query-key factories', () => {
  describe('notificationKeys', () => {
    it('all() returns root notification key', () => {
      expect(notificationKeys.all()).toEqual(['notifications']);
    });

    it('unreadCount() returns unreadCount key', () => {
      expect(notificationKeys.unreadCount()).toEqual(['notifications', 'unreadCount']);
    });

    it('list() returns list key with filters', () => {
      const filters = { page: 1, limit: 20, type: 'review_completed', unreadOnly: true };
      expect(notificationKeys.list(filters)).toEqual(['notifications', 'list', filters]);
    });

    it('list() with no args returns list key with empty object', () => {
      expect(notificationKeys.list()).toEqual(['notifications', 'list', {}]);
    });
  });

  describe('consultationKeys', () => {
    it('all() returns root consultation key', () => {
      expect(consultationKeys.all()).toEqual(['consultations']);
    });

    it('pending() returns pending key with assignmentId and page', () => {
      expect(consultationKeys.pending(42, 1)).toEqual(['consultations', 'pending', 42, 1]);
    });
  });

  describe('extensionKeys', () => {
    it('all() returns root extension key', () => {
      expect(extensionKeys.all()).toEqual(['extensions']);
    });

    it('pending() returns pending key with assignmentId', () => {
      expect(extensionKeys.pending(42)).toEqual(['extensions', 'pending', 42]);
    });
  });

  describe('assignmentKeys', () => {
    it('all() returns root assignment key', () => {
      expect(assignmentKeys.all()).toEqual(['assignments']);
    });

    it('detail() returns detail key with assignmentId', () => {
      expect(assignmentKeys.detail(42)).toEqual(['assignments', 'detail', 42]);
    });
  });

  describe('userKeys', () => {
    it('all() returns root user key', () => {
      expect(userKeys.all()).toEqual(['users']);
    });

    it('list() returns list key with filters', () => {
      const filters = { page: 1, limit: 20, search: '', role: 'instructor' };
      expect(userKeys.list(filters)).toEqual(['users', 'list', filters]);
    });

    it('list() with no args returns list key with empty object', () => {
      expect(userKeys.list()).toEqual(['users', 'list', {}]);
    });
  });

  describe('templateKeys', () => {
    it('all() returns root template key', () => {
      expect(templateKeys.all()).toEqual(['templates']);
    });

    it('list() returns list key with filters', () => {
      const filters = { page: 1, limit: 100, search: '' };
      expect(templateKeys.list(filters)).toEqual(['templates', 'list', filters]);
    });

    it('list() with no args returns list key with empty object', () => {
      expect(templateKeys.list()).toEqual(['templates', 'list', {}]);
    });
  });

  describe('discussionKeys', () => {
    it('all() returns root discussion key', () => {
      expect(discussionKeys.all()).toEqual(['discussions']);
    });

    it('list() returns list key with checkpointId and page', () => {
      expect(discussionKeys.list(42, 1)).toEqual(['discussions', 'list', 42, 1]);
    });

    it('detail() returns detail key with checkpointId', () => {
      expect(discussionKeys.detail(42)).toEqual(['discussions', 'detail', 42]);
    });
  });

  describe('settingsKeys', () => {
    it('currentUser() returns settings currentUser key', () => {
      expect(settingsKeys.currentUser()).toEqual(['settings', 'currentUser']);
    });

    it('activeSessions() returns settings activeSessions key', () => {
      expect(settingsKeys.activeSessions()).toEqual(['settings', 'activeSessions']);
    });

    it('twoFactorStatus() returns settings twoFactorStatus key', () => {
      expect(settingsKeys.twoFactorStatus()).toEqual(['settings', 'twoFactorStatus']);
    });

    it('accessibility() returns settings accessibility key', () => {
      expect(settingsKeys.accessibility()).toEqual(['settings', 'accessibility']);
    });
  });

  describe('gradebookKeys', () => {
    it('studentFinalGrade() returns gradebook studentFinalGrade key with assignmentId', () => {
      expect(gradebookKeys.studentFinalGrade(42)).toEqual(['gradebook', 'studentFinalGrade', 42]);
    });
  });
});
