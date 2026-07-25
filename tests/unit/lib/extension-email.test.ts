/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendExtensionApprovedEmail } from '@/lib/extension-email';
import { enqueueEventEmail } from '@/lib/event-email';
import { getDb } from '@/db/index';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/event-email', () => ({ enqueueEventEmail: vi.fn().mockResolvedValue(undefined) }));

function createMockDb() {
  const then = vi
    .fn()
    .mockImplementation((fn: any) => Promise.resolve([{ title: 'Test Assignment' }]).then(fn));
  const limit = vi.fn().mockReturnValue({ then });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where, limit, then };
}

describe('sendExtensionApprovedEmail — notificationType param (TRACK-022)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  it('passes notificationType to enqueueEventEmail when provided', async () => {
    await sendExtensionApprovedEmail({
      studentId: 'student-1',
      instructorName: 'Instructor',
      assignmentId: 1,
      extensionDays: 3,
      notificationType: 'deadline_extended',
    });

    expect(enqueueEventEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: 'deadline_extended',
      }),
    );
  });

  it('does not pass notificationType when not provided (defaults to templateType)', async () => {
    await sendExtensionApprovedEmail({
      studentId: 'student-1',
      instructorName: 'Instructor',
      assignmentId: 1,
      extensionDays: 3,
    });

    const callArg = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(callArg.templateType).toBe('extension_approved');
    expect(callArg.notificationType).toBeUndefined();
  });
});
