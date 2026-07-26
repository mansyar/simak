import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/routes/__root';
import type {
  AssignmentGradeConfig,
  ContributingCheckpoint,
  FinalGradeResult,
} from '@/lib/grade-computation';

interface StudentGrade {
  studentId: string;
  studentName: string;
  checkpoints: ContributingCheckpoint[];
  finalGrade: FinalGradeResult | null;
}

interface GradebookTableProps {
  students: StudentGrade[];
  config: AssignmentGradeConfig | null;
}

export function GradebookTable({ students, config: _config }: GradebookTableProps) {
  const { t } = useI18n();

  const checkpointCols = new Map<string, number>();
  for (const s of students) {
    if (s.finalGrade) {
      for (const cp of s.finalGrade.contributingCheckpoints) {
        if (!checkpointCols.has(cp.checkpointName)) {
          checkpointCols.set(cp.checkpointName, cp.order);
        }
      }
    }
  }
  const sortedCols = Array.from(checkpointCols.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => name);

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{t('gradebook.empty')}</p>;
  }

  const statusBadge: Record<
    string,
    { variant: 'success' | 'warning' | 'secondary'; label: string }
  > = {
    complete: { variant: 'success', label: t('gradebook.status.complete') },
    in_progress: { variant: 'warning', label: t('gradebook.status.in_progress') },
    incomplete: { variant: 'secondary', label: t('gradebook.status.incomplete') },
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('gradebook.studentName')}</TableHead>
          {sortedCols.map((name) => (
            <TableHead key={name}>{name}</TableHead>
          ))}
          <TableHead>{t('gradebook.numericScore')}</TableHead>
          <TableHead>{t('gradebook.finalGrade')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => {
          const scoreMap = new Map(
            (student.finalGrade?.contributingCheckpoints ?? []).map((cp) => [
              cp.checkpointName,
              cp,
            ]),
          );
          const status =
            statusBadge[student.finalGrade?.status ?? 'incomplete'] ?? statusBadge.incomplete;
          return (
            <TableRow key={student.studentId}>
              <TableCell>{student.studentName}</TableCell>
              {sortedCols.map((name) => {
                const cp = scoreMap.get(name);
                if (!cp) return <TableCell key={name}>—</TableCell>;
                if (cp.isRubric) return <TableCell key={name}>{cp.score}</TableCell>;
                return (
                  <TableCell key={name}>
                    <Badge variant={cp.state === 'passed' ? 'success' : 'error'}>
                      {cp.state === 'passed' ? t('gradebook.passed') : t('gradebook.notPassed')}
                    </Badge>
                  </TableCell>
                );
              })}
              <TableCell>{student.finalGrade?.numericScore ?? '—'}</TableCell>
              <TableCell>{student.finalGrade?.letterGrade ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
