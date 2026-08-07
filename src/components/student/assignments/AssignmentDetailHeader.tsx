import { Calendar, User, Clipboard } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { useStudentDateFormatter } from '@/hooks/use-student-date';

export interface AssignmentDetail {
  title: string;
  description: string | null;
  finalDeadline: Date;
  effectiveDeadline?: Date | string | null;
  instructorName: string;
  templateName: string;
  templateType: string;
  status?: 'draft' | 'active' | 'archived';
  context?: {
    term: { name: string };
    course: { code: string; name: string };
    section: { code: string; name: string | null };
  } | null;
}

interface AssignmentDetailHeaderProps {
  detail: AssignmentDetail;
}

export function AssignmentDetailHeader({ detail }: AssignmentDetailHeaderProps) {
  const { t, locale } = useI18n();
  const { format } = useStudentDateFormatter(locale);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Badge variant="outline">{detail.templateType}</Badge>
        {detail.status && (
          <Badge variant="secondary">
            {t(`studentAssignments.status.${detail.status}` as never)}
          </Badge>
        )}
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
                  date: format(new Date(detail.effectiveDeadline), 'short') || '—',
                })
              : t('studentAssignments.finalDeadline', {
                  date: format(new Date(detail.finalDeadline), 'short') || '—',
                })}
          </span>
        </div>
      </div>

      {detail.context && (
        <div
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
          aria-label={t('studentAssignments.context.section')}
        >
          <span>{detail.context.course.code}</span>
          <span>{detail.context.section.name ?? detail.context.section.code}</span>
          <span>{detail.context.term.name}</span>
        </div>
      )}
    </div>
  );
}
