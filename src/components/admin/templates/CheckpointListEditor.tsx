import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface CheckpointListEditorProps {
  checkpoints: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  errors?: (string | undefined)[];
}

export function CheckpointListEditor({
  checkpoints,
  onAdd,
  onRemove,
  onChange,
  onMoveUp,
  onMoveDown,
  errors,
}: CheckpointListEditorProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {checkpoints.map((checkpoint, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex flex-col">
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
            <div className="flex-1">
              <Input
                value={checkpoint}
                onChange={(e) => onChange(index, e.target.value)}
                placeholder={t('adminTemplates.form.checkpointName')}
                data-testid={`checkpoint-input-${index}`}
              />
              {errors?.[index] && <p className="text-sm text-destructive mt-1">{errors[index]}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              disabled={checkpoints.length <= 1}
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
