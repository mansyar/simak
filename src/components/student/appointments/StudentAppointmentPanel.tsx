import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatAppointmentRange } from '@/lib/appointment-policies';
import { isServerError } from '@/lib/errors';
import { DEFAULT_TIME_ZONE } from '@/lib/timezone';
import { useStudentTimezone } from '@/hooks/use-student-timezone';
import {
  bookAppointment,
  cancelAppointment,
  listAvailableAppointments,
  listStudentAppointments,
  rescheduleAppointment,
  type AppointmentListItem,
} from '@/server/appointments';
import { useI18n } from '@/routes/__root';

type StudentCheckpoint = {
  id: number;
  name: string;
};

export type StudentAppointmentPanelProps = {
  assignmentId: number;
  checkpoints: StudentCheckpoint[];
  onRecordConsultation: (checkpointId: number) => void;
};

export function StudentAppointmentPanel({
  assignmentId,
  checkpoints,
  onRecordConsultation,
}: StudentAppointmentPanelProps) {
  const { locale, t } = useI18n();
  const { timezone: studentTimeZone, hydrated } = useStudentTimezone();
  const [availableAppointments, setAvailableAppointments] = useState<AppointmentListItem[]>([]);
  const [studentAppointments, setStudentAppointments] = useState<AppointmentListItem[]>([]);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<
    Record<number, number | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentListItem | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const [availableResult, studentResult] = await Promise.all([
        listAvailableAppointments({ data: { assignmentId, page: 1, limit: 100 } }),
        listStudentAppointments({ data: { assignmentId, page: 1, limit: 100 } }),
      ]);

      if (isServerError(availableResult) || isServerError(studentResult)) {
        throw new Error('Appointment list request failed');
      }

      setAvailableAppointments(availableResult.appointments);
      setStudentAppointments(studentResult.appointments);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  async function handleBook(appointment: AppointmentListItem) {
    setBusyAppointmentId(appointment.id);
    setConflict(false);
    const checkpointId =
      selectedCheckpoints[appointment.id] ?? appointment.checkpointId ?? undefined;

    try {
      const result = await bookAppointment({
        data: {
          appointmentId: appointment.id,
          ...(checkpointId === undefined ? {} : { checkpointId }),
        },
      });
      if (isServerError(result)) {
        setConflict(result.error.code === 'CONFLICT');
        return;
      }
      await loadAppointments();
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setBusyAppointmentId(cancelTarget.id);
    try {
      const result = await cancelAppointment({ data: { appointmentId: cancelTarget.id } });
      if (!isServerError(result)) {
        setCancelTarget(null);
        await loadAppointments();
      }
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function handleReschedule(appointment: AppointmentListItem) {
    const replacement = availableAppointments.find((candidate) => candidate.id !== appointment.id);
    if (!replacement) return;

    setBusyAppointmentId(appointment.id);
    setConflict(false);
    try {
      const result = await rescheduleAppointment({
        data: { appointmentId: appointment.id, replacementAppointmentId: replacement.id },
      });
      if (isServerError(result)) {
        setConflict(result.error.code === 'CONFLICT');
        return;
      }
      await loadAppointments();
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function renderRange(appointment: AppointmentListItem) {
    return formatAppointmentRange(
      appointment.startAt,
      appointment.endAt,
      hydrated ? studentTimeZone : DEFAULT_TIME_ZONE,
      locale === 'id' ? 'id' : 'en',
    );
  }

  function renderStatusLabel(status: AppointmentListItem['status']) {
    switch (status) {
      case 'booked':
        return t('appointments.student.booked');
      case 'cancelled':
        return t('appointments.student.cancelled');
      case 'completed':
        return t('appointments.student.completed');
      case 'no_show':
        return t('appointments.student.noShow');
    }
  }

  function renderAppointment(appointment: AppointmentListItem, isAvailable: boolean) {
    const range = renderRange(appointment);
    const isBusy = busyAppointmentId === appointment.id;
    const selectedCheckpoint =
      selectedCheckpoints[appointment.id] ?? appointment.checkpointId ?? '';

    return (
      <li
        key={appointment.id}
        className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">{range.startLabel}</p>
            <p className="text-sm text-muted-foreground">{range.endLabel}</p>
            {appointment.checkpointName && (
              <p className="text-sm text-muted-foreground">{appointment.checkpointName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('appointments.student.timeZone', { timeZone: range.timeZone })}
            </p>
            <p className="text-sm font-medium">
              {isAvailable
                ? t('appointments.student.available')
                : renderStatusLabel(appointment.status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAvailable && (
              <Button type="button" loading={isBusy} onClick={() => void handleBook(appointment)}>
                {t('appointments.student.book')}
              </Button>
            )}
            {appointment.status === 'booked' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  loading={isBusy}
                  onClick={() => setCancelTarget(appointment)}
                >
                  {t('appointments.student.cancel')}
                </Button>
                {availableAppointments.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    loading={isBusy}
                    onClick={() => void handleReschedule(appointment)}
                  >
                    {t('appointments.student.reschedule')}
                  </Button>
                )}
              </>
            )}
            {appointment.status === 'completed' && appointment.checkpointId !== null && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const { checkpointId } = appointment;
                  if (checkpointId !== null) onRecordConsultation(checkpointId);
                }}
              >
                {t('appointments.student.recordConsultation')}
              </Button>
            )}
          </div>
        </div>
        {isAvailable && appointment.checkpointId === null && checkpoints.length > 0 && (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span>{t('appointments.student.checkpoint')}</span>
            <select
              className="min-h-11 rounded-md border border-input bg-background px-3"
              value={selectedCheckpoint}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setSelectedCheckpoints((current) => ({
                  ...current,
                  [appointment.id]: value === '' ? undefined : Number(value),
                }));
              }}
            >
              <option value="">{t('appointments.student.noCheckpoint')}</option>
              {checkpoints.map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </li>
    );
  }

  if (loading) {
    return <p role="status">{t('appointments.student.loading')}</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p>{t('appointments.student.error')}</p>
        <Button type="button" variant="outline" onClick={() => void loadAppointments()}>
          {t('appointments.student.retry')}
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="student-appointments-title" className="space-y-6">
      <h2 id="student-appointments-title" className="text-xl font-semibold">
        {t('appointments.student.title')}
      </h2>
      {conflict && (
        <p role="alert" className="text-sm text-destructive">
          {t('appointments.student.conflict')}
        </p>
      )}
      <section aria-labelledby="available-appointments-title" className="space-y-3">
        <h3 id="available-appointments-title" className="font-semibold">
          {t('appointments.student.availableSlots')}
        </h3>
        {availableAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('appointments.student.empty')}</p>
        ) : (
          <ul className="grid gap-3">
            {availableAppointments.map((appointment) => renderAppointment(appointment, true))}
          </ul>
        )}
      </section>
      <section aria-labelledby="student-appointments-list-title" className="space-y-3">
        <h3 id="student-appointments-list-title" className="font-semibold">
          {t('appointments.student.yourAppointments')}
        </h3>
        {studentAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('appointments.student.noBooked')}</p>
        ) : (
          <ul className="grid gap-3">
            {studentAppointments.map((appointment) => renderAppointment(appointment, false))}
          </ul>
        )}
      </section>
      {cancelTarget !== null && (
        <Dialog open onOpenChange={(open) => !open && setCancelTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('appointments.student.cancelTitle')}</DialogTitle>
              <DialogDescription>{t('appointments.student.cancelDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
                {t('appointments.student.keep')}
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleCancel()}>
                {t('appointments.student.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
