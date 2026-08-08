// Server-only lifecycle handlers. Implemented by later appointment phases.

async function appointmentLifecycleHandlerNotImplemented(_context: unknown): Promise<never> {
  throw new Error('Appointment lifecycle handler is not implemented');
}

export const listAvailableAppointmentsHandler = appointmentLifecycleHandlerNotImplemented;
export const listStudentAppointmentsHandler = appointmentLifecycleHandlerNotImplemented;
export const bookAppointmentHandler = appointmentLifecycleHandlerNotImplemented;
export const rescheduleAppointmentHandler = appointmentLifecycleHandlerNotImplemented;
export const completeAppointmentHandler = appointmentLifecycleHandlerNotImplemented;
export const markAppointmentNoShowHandler = appointmentLifecycleHandlerNotImplemented;
export const getAppointmentDetailHandler = appointmentLifecycleHandlerNotImplemented;
