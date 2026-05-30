import { useState } from 'react';
import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requestExtension } from '@/server/extensions';

interface CheckpointOption {
  id: number;
  name: string;
}

interface ExtensionRequestFormProps {
  assignmentId: number;
  maxExtensionDays: number;
  maxTotalExtensions: number;
  checkpoints: CheckpointOption[];
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = ['personal', 'research', 'health', 'other'] as const;

export function ExtensionRequestForm({
  assignmentId,
  maxExtensionDays,
  maxTotalExtensions,
  checkpoints,
  onSuccess,
}: ExtensionRequestFormProps) {
  const { t } = useI18n();

  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isFormValid = category && reason.length >= 10 && duration && Number(duration) >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    const fn = requestExtension as unknown as (args: {
      data: {
        assignmentId: number;
        category: string;
        reason: string;
        extensionDays: number;
        checkpointId?: number;
      };
    }) => Promise<{ error?: string; extensionRequest?: { id: number } }>;

    const result = await fn({
      data: {
        assignmentId,
        category,
        reason,
        extensionDays: Number(duration),
        ...(checkpointId ? { checkpointId: Number(checkpointId) } : {}),
      },
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setCategory('');
    setReason('');
    setDuration('');
    setCheckpointId('');
    onSuccess();
  };

  const charDisplay =
    reason.length > 0 ? (
      <p className="text-xs text-muted-foreground mt-1 text-right">
        {reason.length < 10
          ? t('extensions.reasonMinChars').replace('{count}', '10')
          : `${reason.length} characters`}
      </p>
    ) : null;

  if (success) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <p className="text-sm text-green-600 font-medium">{t('extensions.successMessage')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category Select */}
      <div className="space-y-2">
        <Label htmlFor="category">{t('extensions.category')}</Label>
        <Select value={category} onValueChange={(val) => setCategory(val ?? '')}>
          <SelectTrigger id="category">
            <SelectValue placeholder={t('extensions.categoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(`extensions.category${cat.charAt(0).toUpperCase() + cat.slice(1)}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reason Textarea */}
      <div className="space-y-2">
        <Label htmlFor="reason">{t('extensions.reason')}</Label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder={t('extensions.reasonPlaceholder')}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {charDisplay}
      </div>

      {/* Duration Input */}
      <div className="space-y-2">
        <Label htmlFor="duration">{t('extensions.duration')}</Label>
        <Input
          id="duration"
          type="number"
          min={1}
          max={maxExtensionDays}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="1"
        />
        <p className="text-xs text-muted-foreground">
          {t('extensions.durationHint')} (max {maxExtensionDays})
        </p>
      </div>

      {/* Checkpoint Select (optional) */}
      {checkpoints.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="checkpoint">{t('extensions.checkpoint')}</Label>
          <Select value={checkpointId} onValueChange={(val) => setCheckpointId(val ?? '')}>
            <SelectTrigger id="checkpoint">
              <SelectValue placeholder={t('extensions.checkpointHint')} />
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
      )}

      {/* Error Display */}
      {error && (
        <p className="text-sm text-destructive" aria-live="polite">
          {error}
        </p>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={!isFormValid || loading}>
        {loading ? t('extensions.submitting') : t('extensions.submit')}
      </Button>
    </form>
  );
}
