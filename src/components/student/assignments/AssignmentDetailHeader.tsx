import { format } from 'date-fns';
import { Calendar, User, Clipboard } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

export interface AssignmentDetail {
  title: string;
  description: string | null;
  finalDeadline: Date;
  instructorName: string;
  templateName: string;
  templateType: string;
}

interface AssignmentDetailHeaderProps {
  detail: AssignmentDetail;
}

export function AssignmentDetailHeader({ detail }: AssignmentDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {detail.templateType}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{detail.title}</h1>
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
            {t('studentAssignments.finalDeadline', {
              date: format(new Date(detail.finalDeadline), 'MMM d, yyyy'),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
