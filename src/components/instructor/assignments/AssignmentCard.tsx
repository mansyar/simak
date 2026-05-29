import { Link } from '@tanstack/react-router';
import { Calendar, Users, Clipboard } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';

export interface AssignmentRow {
  id: number;
  title: string;
  description: string | null;
  finalDeadline: Date;
  createdAt: Date;
  templateName: string;
  templateType: string;
  studentCount: number;
}

interface AssignmentCardProps {
  assignment: AssignmentRow;
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const { t } = useI18n();

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
      {/* Decorative gradient top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-violet-500 opacity-80" />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {assignment.templateType}
            </span>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {assignment.title}
            </h3>
          </div>
        </div>

        {assignment.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{assignment.description}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3 mt-3">
          <div className="flex items-center gap-1.5">
            <Clipboard className="h-3.5 w-3.5 text-primary/60" />
            <span className="font-medium text-foreground">{assignment.templateName}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {t('instructorAssignments.studentCount', { count: String(assignment.studentCount) })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {t('instructorAssignments.finalDeadline', {
                date: format(new Date(assignment.finalDeadline), 'MMM d, yyyy'),
              })}
            </span>
          </div>
        </div>

        <Link
          to={`/instructor/assignments/${assignment.id}` as never}
          className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground px-2.5 py-1.5 text-primary"
        >
          {t('common.viewAll')} &rarr;
        </Link>
      </div>
    </div>
  );
}
