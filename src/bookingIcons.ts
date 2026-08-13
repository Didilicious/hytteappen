export const bookingIconNames = {
  calendar: 'icon_calendar_booking',
  newBooking: 'icon_calendar_new',
  editBookings: 'icon_calendar_edit',
} as const

export const currentBookingIconNames = [
  bookingIconNames.calendar,
  bookingIconNames.newBooking,
  bookingIconNames.editBookings,
] as const
