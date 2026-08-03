export type StudentCheckpointState =
  | 'locked'
  | 'unlocked'
  | 'submitted'
  | 'under_review'
  | 'passed'
  | 'revise';

export interface StudentActionCandidate {
  assignmentId: number;
  assignmentTitle: string;
  checkpointId: number;
  checkpointName: string;
  state: StudentCheckpointState;
  dueDate: Date | null;
  minConsultations: number | null;
  verifiedConsultationCount: number;
  submissionId: number | null;
}

export type StudentActionKind = 'submit' | 'revise' | 'consultation';

export type StudentActionPriority =
  | 'overdue'
  | 'revise'
  | 'consultation'
  | 'within_168_hours'
  | 'dated'
  | 'undated';

export interface StudentNextAction {
  assignmentId: number;
  assignmentTitle: string;
  checkpointId: number;
  checkpointName: string;
  dueDate: Date | null;
  kind: StudentActionKind;
  priority: StudentActionPriority;
  submissionId: number | null;
  href: string;
}

export interface StudentWaitingRepresentative {
  assignmentId: number;
  assignmentTitle: string;
  checkpointId: number;
  checkpointName: string;
  dueDate: Date | null;
  submissionId: number | null;
  href: string;
}

export interface StudentWaitingGroup {
  count: number;
  representatives: StudentWaitingRepresentative[];
}

export interface StudentNextActionsResult {
  primaryActions: StudentNextAction[];
  waitingSummary: {
    submitted: StudentWaitingGroup;
    underReview: StudentWaitingGroup;
  };
}

const MAX_PRIMARY_ACTIONS = 5;
const MAX_WAITING_REPRESENTATIVES = 3;
const HOURS_168 = 168 * 60 * 60 * 1000;

const priorityRank: Record<StudentActionPriority, number> = {
  overdue: 0,
  revise: 1,
  consultation: 2,
  within_168_hours: 3,
  dated: 4,
  undated: 5,
};

function checkpointKey(candidate: Pick<StudentActionCandidate, 'assignmentId' | 'checkpointId'>) {
  return `${candidate.assignmentId}:${candidate.checkpointId}`;
}

function compareDueDates(left: Date | null, right: Date | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.getTime() - right.getTime();
}

function getActionPriority(
  kind: StudentActionKind,
  dueDate: Date | null,
  now: Date,
): StudentActionPriority {
  if (dueDate !== null && dueDate.getTime() < now.getTime()) return 'overdue';
  if (kind === 'revise') return 'revise';
  if (kind === 'consultation') return 'consultation';
  if (dueDate === null) return 'undated';
  if (dueDate.getTime() <= now.getTime() + HOURS_168) return 'within_168_hours';
  return 'dated';
}

function getActionKind(candidate: StudentActionCandidate): StudentActionKind | null {
  if (candidate.state === 'revise') return 'revise';
  if (candidate.state !== 'unlocked') return null;

  const requiredConsultations = candidate.minConsultations ?? 0;
  if (candidate.verifiedConsultationCount < requiredConsultations) return 'consultation';
  return 'submit';
}

function toAction(candidate: StudentActionCandidate, now: Date): StudentNextAction | null {
  const kind = getActionKind(candidate);
  if (kind === null) return null;

  return {
    assignmentId: candidate.assignmentId,
    assignmentTitle: candidate.assignmentTitle,
    checkpointId: candidate.checkpointId,
    checkpointName: candidate.checkpointName,
    dueDate: candidate.dueDate,
    kind,
    priority: getActionPriority(kind, candidate.dueDate, now),
    submissionId: candidate.submissionId,
    href:
      kind === 'consultation'
        ? `/student/assignments/${candidate.assignmentId}`
        : `/student/assignments/${candidate.assignmentId}/checkpoints/${candidate.checkpointId}`,
  };
}

function compareActions(left: StudentNextAction, right: StudentNextAction) {
  const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const dueDateDifference = compareDueDates(left.dueDate, right.dueDate);
  if (dueDateDifference !== 0) return dueDateDifference;

  const assignmentDifference = left.assignmentId - right.assignmentId;
  if (assignmentDifference !== 0) return assignmentDifference;
  return left.checkpointId - right.checkpointId;
}

function toWaitingRepresentative(candidate: StudentActionCandidate): StudentWaitingRepresentative {
  return {
    assignmentId: candidate.assignmentId,
    assignmentTitle: candidate.assignmentTitle,
    checkpointId: candidate.checkpointId,
    checkpointName: candidate.checkpointName,
    dueDate: candidate.dueDate,
    submissionId: candidate.submissionId,
    href: `/student/assignments/${candidate.assignmentId}/checkpoints/${candidate.checkpointId}`,
  };
}

function compareWaiting(left: StudentWaitingRepresentative, right: StudentWaitingRepresentative) {
  const dueDateDifference = compareDueDates(left.dueDate, right.dueDate);
  if (dueDateDifference !== 0) return dueDateDifference;

  const assignmentDifference = left.assignmentId - right.assignmentId;
  if (assignmentDifference !== 0) return assignmentDifference;
  return left.checkpointId - right.checkpointId;
}

function selectWaitingRepresentatives(
  submitted: StudentWaitingRepresentative[],
  underReview: StudentWaitingRepresentative[],
) {
  const groups = [submitted, underReview].filter((group) => group.length > 0);
  const selected = groups.map((group) => group[0]);
  const selectedKeys = new Set(selected.map(checkpointKey));
  const remaining = [...submitted, ...underReview]
    .filter((item) => !selectedKeys.has(checkpointKey(item)))
    .sort(compareWaiting);

  for (const item of remaining) {
    if (selected.length >= MAX_WAITING_REPRESENTATIVES) break;
    selected.push(item);
  }

  const selectedSet = new Set(selected.map(checkpointKey));
  return {
    submitted: submitted.filter((item) => selectedSet.has(checkpointKey(item))),
    underReview: underReview.filter((item) => selectedSet.has(checkpointKey(item))),
  };
}

export function resolveStudentNextActions(
  candidates: StudentActionCandidate[],
  options: { now?: Date } = {},
): StudentNextActionsResult {
  const now = options.now ?? new Date();
  const actionsByCheckpoint = new Map<string, StudentNextAction>();
  const submittedByCheckpoint = new Map<string, StudentWaitingRepresentative>();
  const underReviewByCheckpoint = new Map<string, StudentWaitingRepresentative>();

  for (const candidate of candidates) {
    const key = checkpointKey(candidate);
    const action = toAction(candidate, now);
    if (action !== null) {
      const existing = actionsByCheckpoint.get(key);
      if (!existing || compareActions(action, existing) < 0) {
        actionsByCheckpoint.set(key, action);
      }
    }

    if (candidate.state === 'submitted') {
      submittedByCheckpoint.set(key, toWaitingRepresentative(candidate));
    } else if (candidate.state === 'under_review') {
      underReviewByCheckpoint.set(key, toWaitingRepresentative(candidate));
    }
  }

  const primaryActions = [...actionsByCheckpoint.values()]
    .sort(compareActions)
    .slice(0, MAX_PRIMARY_ACTIONS);
  const waiting = selectWaitingRepresentatives(
    [...submittedByCheckpoint.values()].sort(compareWaiting),
    [...underReviewByCheckpoint.values()].sort(compareWaiting),
  );

  return {
    primaryActions,
    waitingSummary: {
      submitted: {
        count: submittedByCheckpoint.size,
        representatives: waiting.submitted,
      },
      underReview: {
        count: underReviewByCheckpoint.size,
        representatives: waiting.underReview,
      },
    },
  };
}
