import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { formatDate } from '@/lib/format-date';
import { useI18n } from '../../../routes/__root';

interface AssignmentData {
  id: number;
  title: string;
  instructorName: string;
  studentCount: number;
  createdAt: Date | null;
}

interface TemplateLinkedAssignmentsProps {
  assignments: AssignmentData[];
}

export function TemplateLinkedAssignments({ assignments }: TemplateLinkedAssignmentsProps) {
  const { t, locale } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('adminTemplates.detail.assignments')}</CardTitle>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('adminTemplates.detail.noAssignments')}
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <ListRow
                key={a.id}
                left={
                  <div>
                    <div className="font-medium text-foreground">{a.title}</div>
                    <div className="text-muted-foreground">
                      {a.instructorName} &middot;{' '}
                      {t('adminTemplates.studentsCount', { count: String(a.studentCount) })}
                    </div>
                  </div>
                }
                right={
                  <div className="text-xs text-muted-foreground">
                    {formatDate(a.createdAt ?? new Date(), locale, 'short')}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
