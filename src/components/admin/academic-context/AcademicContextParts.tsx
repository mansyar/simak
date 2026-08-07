import { type ReactNode } from 'react';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Field({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string;
  label: ReactNode;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="h-10 rounded-md border bg-background px-3"
      />
    </label>
  );
}

export function CollectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export function CollectionRow({
  label,
  status,
  onEdit,
  onArchive,
}: {
  label: ReactNode;
  status?: string;
  onEdit?: () => void;
  onArchive: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="min-w-0 truncate font-medium">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        {status && <Badge variant="outline">{status}</Badge>}
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            {t('adminAcademicContext.actions.edit')}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
          {t('adminAcademicContext.actions.archive')}
        </Button>
      </div>
    </div>
  );
}
