async function appointmentHandlerNotImplemented(_context: unknown): Promise<never> {
  throw new Error('Appointment handlers are not implemented');
}

export const createAppointmentSlotHandler = appointmentHandlerNotImplemented;
export const listInstructorAppointmentsHandler = appointmentHandlerNotImplemented;
export const cancelAppointmentHandler = appointmentHandlerNotImplemented;
export const listAvailableAppointmentsHandler = appointmentHandlerNotImplemented;
export const listStudentAppointmentsHandler = appointmentHandlerNotImplemented;
export const bookAppointmentHandler = appointmentHandlerNotImplemented;
export const rescheduleAppointmentHandler = appointmentHandlerNotImplemented;
export const completeAppointmentHandler = appointmentHandlerNotImplemented;
export const markAppointmentNoShowHandler = appointmentHandlerNotImplemented;
export const getAppointmentDetailHandler = appointmentHandlerNotImplemented;
