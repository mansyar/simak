import { describe, it, expect } from 'vitest';
import {
  notificationKeys,
  consultationKeys,
  extensionKeys,
  assignmentKeys,
  userKeys,
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
});
