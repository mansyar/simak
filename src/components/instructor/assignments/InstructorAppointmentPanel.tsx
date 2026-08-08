import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatAppointmentRange, validateAppointmentWindow } from '@/lib/appointment-policies';
import { isServerError } from '@/lib/errors';
import { DEFAULT_TIME_ZONE, resolveTimeZone } from '@/lib/timezone';
import {
  cancelAppointment,
  completeAppointment,
  createAppointmentSlot,
  listInstructorAppointments,
  markAppointmentNoShow,
  rescheduleAppointment,
  type AppointmentListItem,
} from '@/server/appointments';
import { useI18n } from '@/routes/__root';

type InstructorCheckpoint = {
  id: number;
  name: string;
};

export type InstructorAppointmentPanelProps = {
  assignmentId: number;
  checkpoints: InstructorCheckpoint[];
};

const statusKeys = {
  available: 'instructorAppointments.available',
  booked: 'instructorAppointments.booked',
  cancelled: 'instructorAppointments.cancelled',
  completed: 'instructorAppointments.completed',
  no_show: 'instructorAppointments.noShow',
} as const;

function toAppointmentDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function InstructorAppointmentPanel({
  assignmentId,
  checkpoints,
}: InstructorAppointmentPanelProps) {
  const { locale, t } = useI18n();
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [replacementIds, setReplacementIds] = useState<Record<number, string>>({});
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentListItem | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const result = await listInstructorAppointments({
        data: { assignmentId, page: 1, limit: 100 },
      });
      if (isServerError(result)) throw new Error('Appointment list request failed');
      setAppointments(result.appointments);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    let detectedTimeZone: string | undefined;
    try {
      detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      detectedTimeZone = undefined;
    }
    setTimeZone(resolveTimeZone(undefined, detectedTimeZone));
  }, []);

  const availableReplacements = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'available'),
    [appointments],
  );

  const getCheckpointName = (appointment: AppointmentListItem) => {
    if (appointment.checkpointName) return appointment.checkpointName;
    return (
      checkpoints.find((checkpoint) => checkpoint.id === appointment.checkpointId)?.name ?? null
    );
  };

  const showActionError = (result: unknown) => {
    if (isServerError(result)) {
      setActionError(
        result.error.code === 'CONFLICT'
          ? t('instructorAppointments.conflict')
          : t('instructorAppointments.error'),
      );
      return true;
    }
    return false;
  };

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setActionError(null);

    const start = new Date(startAt);
    const end = new Date(endAt);
    const window = validateAppointmentWindow(start, end);
    if (!window.valid) {
      setFormError(t('instructorAppointments.invalidWindow'));
      return;
    }

    try {
      const result = await createAppointmentSlot({
        data: {
          assignmentId,
          startAt: start,
          endAt: end,
          ...(checkpointId ? { checkpointId: Number(checkpointId) } : {}),
        },
      });
      if (showActionError(result)) return;
      setStartAt('');
      setEndAt('');
      setCheckpointId('');
      await loadAppointments();
    } catch {
      setActionError(t('instructorAppointments.error'));
    }
  }

  async function handleCancel(appointment: AppointmentListItem) {
    setBusyAppointmentId(appointment.id);
    setActionError(null);
    try {
      const result = await cancelAppointment({ data: { appointmentId: appointment.id } });
      if (!showActionError(result)) {
        setCancelTarget(null);
        await loadAppointments();
      }
    } catch {
      setActionError(t('instructorAppointments.error'));
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function handleReschedule(appointment: AppointmentListItem) {
    const replacementId = Number(replacementIds[appointment.id]);
    if (!replacementId) return;
    setBusyAppointmentId(appointment.id);
    setActionError(null);
    try {
      const result = await rescheduleAppointment({
        data: { appointmentId: appointment.id, replacementAppointmentId: replacementId },
      });
      if (!showActionError(result)) await loadAppointments();
    } catch {
      setActionError(t('instructorAppointments.error'));
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function handleOutcome(
    appointmentId: number,
    action: typeof completeAppointment | typeof markAppointmentNoShow,
  ) {
    setBusyAppointmentId(appointmentId);
    setActionError(null);
    try {
      const result = await action({ data: { appointmentId } });
      if (!showActionError(result)) await loadAppointments();
    } catch {
      setActionError(t('instructorAppointments.error'));
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function renderAppointment(appointment: AppointmentListItem) {
    const isBooked = appointment.status === 'booked';
    const isEnded = toAppointmentDate(appointment.endAt).getTime() <= Date.now();
    const canCancel = appointment.status === 'available' || appointment.status === 'booked';
    const replacements = availableReplacements.filter(
      (candidate) => candidate.id !== appointment.id,
    );
    const range = formatAppointmentRange(
      toAppointmentDate(appointment.startAt),
      toAppointmentDate(appointment.endAt),
      timeZone,
      locale,
    );
    const checkpointName = getCheckpointName(appointment);
    const studentName = appointment.studentName ?? t('instructorAppointments.noStudent');

    return (
      <article key={appointment.id} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">
              {range.startLabel} – {range.endLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('instructorAppointments.timeZone', { timeZone: range.timeZone })}
            </p>
            <p className="text-sm">
              {t('instructorAppointments.student')}: {studentName}
            </p>
            {checkpointName && <p className="text-sm text-muted-foreground">{checkpointName}</p>}
          </div>
          <span className="rounded-full border px-3 py-1 text-sm font-medium">
            {t(statusKeys[appointment.status])}
          </span>
        </div>

        {(canCancel || (isBooked && replacements.length > 0) || (isBooked && isEnded)) && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            {canCancel && (
              <Button
                variant="outline"
                loading={busyAppointmentId === appointment.id}
                onClick={() => setCancelTarget(appointment)}
              >
                {t('instructorAppointments.cancel')}
              </Button>
            )}
            {isBooked && replacements.length > 0 && (
              <div className="flex min-w-52 flex-col gap-1">
                <label htmlFor={`replacement-${appointment.id}`} className="text-sm font-medium">
                  {t('instructorAppointments.replacement')}
                </label>
                <select
                  id={`replacement-${appointment.id}`}
                  className="min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={replacementIds[appointment.id] ?? ''}
                  onChange={(event) =>
                    setReplacementIds((current) => ({
                      ...current,
                      [appointment.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">{t('instructorAppointments.selectReplacement')}</option>
                  {replacements.map((replacement) => (
                    <option key={replacement.id} value={replacement.id}>
                      {
                        formatAppointmentRange(
                          toAppointmentDate(replacement.startAt),
                          toAppointmentDate(replacement.endAt),
                          timeZone,
                          locale,
                        ).startLabel
                      }
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!replacementIds[appointment.id]}
                  loading={busyAppointmentId === appointment.id}
                  onClick={() => void handleReschedule(appointment)}
                >
                  {t('instructorAppointments.reschedule')}
                </Button>
              </div>
            )}
            {isBooked && isEnded && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  loading={busyAppointmentId === appointment.id}
                  onClick={() => void handleOutcome(appointment.id, completeAppointment)}
                >
                  {t('instructorAppointments.complete')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  loading={busyAppointmentId === appointment.id}
                  onClick={() => void handleOutcome(appointment.id, markAppointmentNoShow)}
                >
                  {t('instructorAppointments.markNoShow')}
                </Button>
              </>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <section aria-labelledby="instructor-appointments-title" className="space-y-5">
      <div className="flex flex-col gap-1">
        <h2 id="instructor-appointments-title" className="text-lg font-semibold">
          {t('instructorAppointments.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('instructorAppointments.timeZone', { timeZone })}
        </p>
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => void handleCreate(event)}
      >
        <h3 className="sm:col-span-2 lg:col-span-5 text-base font-semibold">
          {t('instructorAppointments.publishTitle')}
        </h3>
        <div className="flex flex-col gap-1">
          <label htmlFor="appointment-start" className="text-sm font-medium">
            {t('instructorAppointments.startAt')}
          </label>
          <input
            id="appointment-start"
            type="datetime-local"
            className="min-h-11 rounded-md border bg-background px-3 text-sm"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="appointment-end" className="text-sm font-medium">
            {t('instructorAppointments.endAt')}
          </label>
          <input
            id="appointment-end"
            type="datetime-local"
            className="min-h-11 rounded-md border bg-background px-3 text-sm"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="appointment-checkpoint" className="text-sm font-medium">
            {t('instructorAppointments.checkpoint')}
          </label>
          <select
            id="appointment-checkpoint"
            className="min-h-11 rounded-md border bg-background px-3 text-sm"
            value={checkpointId}
            onChange={(event) => setCheckpointId(event.target.value)}
          >
            <option value="">{t('instructorAppointments.allCheckpoints')}</option>
            {checkpoints.map((checkpoint) => (
              <option key={checkpoint.id} value={checkpoint.id}>
                {checkpoint.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">{t('instructorAppointments.publish')}</Button>
      </form>

      {formError && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          {formError}
        </p>
      )}
      {actionError && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {loading ? (
        <p role="status" aria-live="polite">
          {t('instructorAppointments.loading')}
        </p>
      ) : loadError ? (
        <div role="status" aria-live="polite" className="space-y-2 rounded-lg border p-4">
          <p>{t('instructorAppointments.error')}</p>
          <Button type="button" variant="outline" onClick={() => void loadAppointments()}>
            {t('instructorAppointments.retry')}
          </Button>
        </div>
      ) : appointments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {t('instructorAppointments.empty')}
        </p>
      ) : (
        <div className="grid gap-3">{appointments.map(renderAppointment)}</div>
      )}

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && busyAppointmentId === null) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('instructorAppointments.cancelConfirm')}</DialogTitle>
            <DialogDescription>{t('instructorAppointments.cancelDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>{t('instructorAppointments.keep')}</DialogClose>
            <Button
              variant="destructive"
              loading={cancelTarget !== null && busyAppointmentId === cancelTarget.id}
              onClick={() => {
                if (cancelTarget) void handleCancel(cancelTarget);
              }}
            >
              {t('instructorAppointments.confirmCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
