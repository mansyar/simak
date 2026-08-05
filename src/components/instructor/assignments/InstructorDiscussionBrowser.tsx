import { useMemo, useState } from 'react';
import { DiscussionPanel } from '@/components/discussions/discussion-panel';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/routes/__root';

export interface InstructorDiscussionStudent {
  id: string | number;
  name: string;
  checkpoints: Array<{ id: number; name: string }>;
}

interface InstructorDiscussionBrowserProps {
  assignmentId: number;
  students: InstructorDiscussionStudent[];
}

interface DiscussionThread {
  key: string;
  studentId: string;
  studentName: string;
  checkpointId: number;
  checkpointName: string;
}

export function InstructorDiscussionBrowser({
  assignmentId,
  students,
}: InstructorDiscussionBrowserProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [selectedThreadKey, setSelectedThreadKey] = useState('');

  const threads = useMemo<DiscussionThread[]>(
    () =>
      students.flatMap((student) =>
        student.checkpoints.map((checkpoint) => ({
          key: `${student.id}-${checkpoint.id}`,
          studentId: String(student.id),
          studentName: student.name,
          checkpointId: checkpoint.id,
          checkpointName: checkpoint.name,
        })),
      ),
    [students],
  );

  const visibleThreads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesStudent = !studentFilter || thread.studentId === studentFilter;
      const matchesSearch =
        !normalizedSearch ||
        `${thread.studentName} ${thread.checkpointName}`.toLowerCase().includes(normalizedSearch);
      return matchesStudent && matchesSearch;
    });
  }, [search, studentFilter, threads]);

  const activeThread =
    visibleThreads.find((thread) => thread.key === selectedThreadKey) ?? visibleThreads[0];

  return (
    <section aria-labelledby="instructor-discussions-heading" className="space-y-4">
      <h2 id="instructor-discussions-heading" className="sr-only">
        {t('discussions.title')}
      </h2>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
        <div className="space-y-1.5">
          <label htmlFor="instructor-discussion-search" className="text-sm font-medium">
            {t('instructorAssignments.discussions.searchLabel')}
          </label>
          <Input
            id="instructor-discussion-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('instructorAssignments.discussions.searchPlaceholder')}
            aria-label={t('instructorAssignments.discussions.searchLabel')}
            className="min-h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="instructor-discussion-student" className="text-sm font-medium">
            {t('instructorAssignments.discussions.studentFilterLabel')}
          </label>
          <select
            id="instructor-discussion-student"
            value={studentFilter}
            onChange={(event) => setStudentFilter(event.target.value)}
            aria-label={t('instructorAssignments.discussions.studentFilterLabel')}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('instructorAssignments.discussions.allStudents')}</option>
            {students.map((student) => (
              <option key={student.id} value={String(student.id)}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleThreads.length === 0 ? (
        <p role="status" className="rounded-md border border-dashed p-6 text-center text-sm">
          {t('instructorAssignments.discussions.noMatches')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
          <div
            aria-label={t('instructorAssignments.discussions.threadListLabel')}
            className="space-y-2"
          >
            {visibleThreads.map((thread) => {
              const isSelected = activeThread?.key === thread.key;
              return (
                <button
                  key={thread.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedThreadKey(thread.key)}
                  className="flex min-h-11 w-full items-center rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">
                    {thread.studentName} — {thread.checkpointName}
                  </span>
                </button>
              );
            })}
          </div>

          {activeThread && (
            <div
              key={activeThread.key}
              aria-label={`${activeThread.studentName} — ${activeThread.checkpointName}`}
              className="min-w-0 rounded-lg border p-4"
            >
              <h3 className="mb-3 text-sm font-semibold">
                {activeThread.studentName} — {activeThread.checkpointName}
              </h3>
              <DiscussionPanel
                checkpointId={activeThread.checkpointId}
                assignmentId={assignmentId}
                instructorView
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
