import { Link } from '@tanstack/react-router';
import { CheckpointListEditor } from './CheckpointListEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '../../../routes/__root';

interface Checkpoint {
  name: string;
  minConsultations: number;
  estimatedDuration: number;
}

interface TemplateCheckpointSectionProps {
  checkpoints: Checkpoint[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onMinConsultationsChange: (index: number, value: number) => void;
  onEstimatedDurationChange: (index: number, value: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function TemplateCheckpointSection({
  checkpoints,
  onAdd,
  onRemove,
  onChange,
  onMinConsultationsChange,
  onEstimatedDurationChange,
  onMoveUp,
  onMoveDown,
  onSave,
  isSaving,
}: TemplateCheckpointSectionProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('adminTemplates.detail.checkpoints')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CheckpointListEditor
          checkpoints={checkpoints}
          onAdd={onAdd}
          onRemove={onRemove}
          onChange={onChange}
          onMinConsultationsChange={onMinConsultationsChange}
          onEstimatedDurationChange={onEstimatedDurationChange}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={isSaving} data-testid="save-template">
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
          <Link to="/admin/templates" search={{ page: 1, limit: 20, search: '', type: '' }}>
            <Button variant="outline" type="button">
              {t('common.cancel')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
