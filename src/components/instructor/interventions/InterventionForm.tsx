import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InterventionContextCard } from './InterventionContextCard';
import {
  CreateInterventionSchema,
  InterventionActionTypeSchema,
  InterventionStatusSchema,
  UpdateInterventionSchema,
} from '@/server/interventions';
import type { LiveStudentRiskContext } from '@/server/student-risk-context.server';
import type { InterventionListItem } from './InterventionList';
import { useI18n } from '@/routes/__root';

type FormValues = Record<string, unknown>;

interface InterventionFormProps {
  mode: 'create' | 'edit';
  assignmentId: number;
  studentId: string;
  intervention?: InterventionListItem;
  context?: LiveStudentRiskContext | null;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel?: () => void;
}

function inputDate(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}

export function InterventionForm({
  mode,
  assignmentId,
  studentId,
  intervention,
  context,
  onSubmit,
  onCancel,
}: InterventionFormProps) {
  const { t } = useI18n();
  const actionLabels = {
    consultation: t('instructorInterventions.actions.consultation'),
    extension: t('instructorInterventions.actions.extension'),
    discussion: t('instructorInterventions.actions.discussion'),
    other: t('instructorInterventions.actions.other'),
  };
  const formTitle =
    mode === 'create'
      ? t('instructorInterventions.createTitle')
      : t('instructorInterventions.editTitle');
  const submitLabel =
    mode === 'create' ? t('instructorInterventions.create') : t('instructorInterventions.edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = useMemo(
    () => (mode === 'create' ? CreateInterventionSchema : UpdateInterventionSchema),
    [mode],
  );
  const defaultValues = useMemo<FormValues>(
    () => ({
      ...(mode === 'create'
        ? { assignmentId, studentId }
        : { interventionId: intervention?.id, status: intervention?.status }),
      actionType: intervention?.actionType ?? 'consultation',
      privateNote: intervention?.privateNote ?? '',
      followUpDate: inputDate(intervention?.followUpDate),
      resolutionReason: intervention?.resolutionReason ?? null,
    }),
    [
      assignmentId,
      intervention?.actionType,
      intervention?.followUpDate,
      intervention?.id,
      intervention?.privateNote,
      intervention?.resolutionReason,
      intervention?.status,
      mode,
      studentId,
    ],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never) as never,
    defaultValues,
  });
  const selectedStatus = form.watch('status');
  const isClosing = selectedStatus === 'resolved' || selectedStatus === 'dismissed';
  const errors = form.formState.errors as Record<string, { message?: string } | undefined>;

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    if (!isClosing) form.setValue('resolutionReason', null);
  }, [form, isClosing]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const followUpValue = values.followUpDate;
    const normalized = {
      ...values,
      followUpDate:
        followUpValue instanceof Date
          ? followUpValue
          : typeof followUpValue === 'string' && followUpValue
            ? new Date(`${followUpValue}T00:00:00.000Z`)
            : mode === 'edit'
              ? null
              : undefined,
    };

    try {
      await onSubmit(normalized);
    } catch {
      setSubmitError(t('instructorInterventions.saveError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {context && <InterventionContextCard context={context} />}
        {submitError && (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {submitError}
          </p>
        )}
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="intervention-action-type">
              {t('instructorInterventions.fields.actionType')}
            </Label>
            <select
              id="intervention-action-type"
              {...form.register('actionType')}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={t('instructorInterventions.fields.actionType')}
            >
              {InterventionActionTypeSchema.options.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionLabels[actionType]}
                </option>
              ))}
            </select>
            <FieldError message={errors.actionType?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="intervention-private-note">
              {t('instructorInterventions.fields.privateNote')}
            </Label>
            <Textarea
              id="intervention-private-note"
              {...form.register('privateNote')}
              placeholder={t('instructorInterventions.fields.privateNotePlaceholder')}
              className="min-h-28"
              aria-label={t('instructorInterventions.fields.privateNote')}
            />
            <FieldError message={errors.privateNote?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="intervention-follow-up-date">
              {t('instructorInterventions.fields.followUpDate')}
            </Label>
            <Input
              id="intervention-follow-up-date"
              type="date"
              {...form.register('followUpDate', {
                setValueAs: (value) => (value ? value : mode === 'edit' ? null : undefined),
              })}
              aria-label={t('instructorInterventions.fields.followUpDate')}
            />
            <p className="text-xs text-muted-foreground">
              {t('instructorInterventions.fields.followUpHelp')}
            </p>
            <FieldError message={errors.followUpDate?.message} />
          </div>

          {mode === 'edit' && (
            <div className="space-y-2">
              <Label htmlFor="intervention-status">
                {t('instructorInterventions.fields.status')}
              </Label>
              <select
                id="intervention-status"
                {...form.register('status')}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={t('instructorInterventions.fields.status')}
              >
                {InterventionStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {t(`instructorInterventions.status.${status}`)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.status?.message} />
            </div>
          )}

          {isClosing && (
            <div className="space-y-2">
              <Label htmlFor="intervention-resolution-reason">
                {t('instructorInterventions.fields.resolutionReason')}
              </Label>
              <Textarea
                id="intervention-resolution-reason"
                {...form.register('resolutionReason', {
                  setValueAs: (value) => (value ? value : null),
                })}
                className="min-h-24"
                aria-label={t('instructorInterventions.fields.resolutionReason')}
              />
              <FieldError message={errors.resolutionReason?.message} />
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" className="min-h-11" loading={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
