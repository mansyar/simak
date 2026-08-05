import { Link } from '@tanstack/react-router';
import { Calendar, Clipboard } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
import { useStudentDateFormatter } from '@/hooks/use-student-date';

export interface StudentAssignmentRow {
  id: number;
  title: string;
  finalDeadline: Date;
  effectiveDeadline?: Date | string | null;
  templateName: string;
  templateType: string;
  progressPercent: number;
}

interface StudentAssignmentCardProps {
  assignment: StudentAssignmentRow;
}

export function StudentAssignmentCard({ assignment }: StudentAssignmentCardProps) {
  const { t, locale } = useI18n();
  const { format } = useStudentDateFormatter(locale);

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="outline">{assignment.templateType}</Badge>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {assignment.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
          <div className="flex items-center gap-1.5">
            <Clipboard className="h-3.5 w-3.5 text-primary/60" />
            <span className="font-medium text-foreground">{assignment.templateName}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <Progress
          value={assignment.progressPercent}
          label={t('studentAssignments.progress')}
          showValue
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>
            {assignment.effectiveDeadline
              ? t('studentAssignments.effectiveDeadline', {
                  date: format(new Date(assignment.effectiveDeadline), 'short') || '—',
                })
              : t('studentAssignments.finalDeadline', {
                  date: format(new Date(assignment.finalDeadline), 'short') || '—',
                })}
          </span>
        </div>

        <Link
          to={`/student/assignments/${assignment.id}` as never}
          className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground px-2.5 py-1.5 text-primary"
        >
          {t('common.viewAll')} &rarr;
        </Link>
      </div>
    </div>
  );
}
