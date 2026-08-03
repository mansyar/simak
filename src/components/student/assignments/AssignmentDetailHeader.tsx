import { Calendar, User, Clipboard } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format-date';
import { useStudentTimezone } from '@/hooks/use-student-timezone';

export interface AssignmentDetail {
  title: string;
  description: string | null;
  finalDeadline: Date;
  effectiveDeadline?: Date | string | null;
  instructorName: string;
  templateName: string;
  templateType: string;
}

interface AssignmentDetailHeaderProps {
  detail: AssignmentDetail;
}

export function AssignmentDetailHeader({ detail }: AssignmentDetailHeaderProps) {
  const { t, locale } = useI18n();
  const { timezone, hydrated } = useStudentTimezone();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Badge variant="outline">{detail.templateType}</Badge>
      </div>

      <div>
        <h1 className="font-display text-3xl text-foreground">{detail.title}</h1>
        {detail.description && (
          <p className="mt-2 text-sm text-muted-foreground">{detail.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="font-medium text-foreground">{detail.instructorName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clipboard className="h-4 w-4" />
          <span className="font-medium text-foreground">{detail.templateName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {detail.effectiveDeadline
              ? t('studentAssignments.effectiveDeadline', {
                  date: hydrated
                    ? formatDate(new Date(detail.effectiveDeadline), locale, 'short', timezone)
                    : '—',
                })
              : t('studentAssignments.finalDeadline', {
                  date: hydrated
                    ? formatDate(new Date(detail.finalDeadline), locale, 'short', timezone)
                    : '—',
                })}
          </span>
        </div>
      </div>
    </div>
  );
}
