import { useState } from 'react';
import { toast } from 'sonner';
import { logConsultation } from '@/server/consultations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '../../routes/__root';

interface CheckpointOption {
  id: number;
  name: string;
}

interface ConsultationFormProps {
  assignmentId: number;
  checkpoints: CheckpointOption[];
  onSuccess: () => void;
}

export function ConsultationForm({
  assignmentId: _assignmentId,
  checkpoints,
  onSuccess,
}: ConsultationFormProps) {
  const { t } = useI18n();
  const [checkpointId, setCheckpointId] = useState<string>('');
  const [sessionType, setSessionType] = useState<string>('internal');
  const [externalConsultantName, setExternalConsultantName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointId) return;

    setLoading(true);
    setError(null);

    const result = await (
      logConsultation as unknown as (args: {
        data: {
          checkpointId: number;
          sessionType: string;
          externalConsultantName?: string;
          notes: string;
        };
      }) => Promise<{ error?: string }>
    )({
      data: {
        checkpointId: Number(checkpointId),
        sessionType,
        externalConsultantName: sessionType === 'external' ? externalConsultantName : undefined,
        notes,
      },
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Reset form
    setCheckpointId('');
    setSessionType('internal');
    setExternalConsultantName('');
    setNotes('');
    setLoading(false);
    toast.success(t('consultations.logSuccess'));
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="checkpoint">{t('consultations.checkpoint')}</Label>
        <Select value={checkpointId} onValueChange={(val) => setCheckpointId(val ?? '')}>
          <SelectTrigger id="checkpoint">
            <SelectValue placeholder={t('consultations.selectCheckpoint')} />
          </SelectTrigger>
          <SelectContent>
            {checkpoints.map((cp) => (
              <SelectItem key={cp.id} value={String(cp.id)}>
                {cp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('consultations.sessionType')}</Label>
        <Select value={sessionType} onValueChange={(val) => setSessionType(val ?? 'internal')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">{t('consultations.internal')}</SelectItem>
            <SelectItem value="external">{t('consultations.external')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sessionType === 'external' && (
        <div className="space-y-2">
          <Label htmlFor="consultantName">{t('consultations.externalConsultantName')}</Label>
          <Input
            id="consultantName"
            value={externalConsultantName}
            onChange={(e) => setExternalConsultantName(e.target.value)}
            placeholder={t('consultations.consultantNamePlaceholder')}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t('consultations.notes')}</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          placeholder={t('consultations.notesPlaceholder')}
          rows={3}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" aria-live="polite">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading || !checkpointId || !notes}>
        {loading ? t('common.loading') : t('consultations.logConsultation')}
      </Button>
    </form>
  );
}
