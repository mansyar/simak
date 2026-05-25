import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface CheckpointData {
  name: string;
  minConsultations: number;
}

interface CheckpointListEditorProps {
  checkpoints: CheckpointData[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onMinConsultationsChange: (index: number, value: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  errors?: (string | undefined)[];
}

export function CheckpointListEditor({
  checkpoints,
  onAdd,
  onRemove,
  onChange,
  onMinConsultationsChange,
  onMoveUp,
  onMoveDown,
  errors,
}: CheckpointListEditorProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {checkpoints.map((checkpoint, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex flex-col pt-1.5">
              <button
                type="button"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('adminTemplates.form.moveUp')}
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(index)}
                disabled={index === checkpoints.length - 1}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('adminTemplates.form.moveDown')}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={checkpoint.name}
                onChange={(e) => onChange(index, e.target.value)}
                placeholder={t('adminTemplates.form.checkpointName')}
                data-testid={`checkpoint-input-${index}`}
              />
              {errors?.[index] && <p className="text-sm text-destructive mt-1">{errors[index]}</p>}
            </div>
            <div className="w-28">
              <Input
                type="number"
                min={0}
                value={checkpoint.minConsultations}
                onChange={(e) => onMinConsultationsChange(index, Math.max(0, Number(e.target.value)))}
                placeholder="0"
                data-testid={`checkpoint-min-cons-${index}`}
                aria-label={t('adminTemplates.form.minConsultations')}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              disabled={checkpoints.length <= 1}
              className="mt-0.5"
              aria-label={t('adminTemplates.form.removeCheckpoint')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('adminTemplates.form.addCheckpoint')}
      </Button>
    </div>
  );
}
