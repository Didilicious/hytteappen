export const notificationLabels = {
  familyEvent: 'Nytt familiearrangement',
  noticeboardPost: 'Nytt oppslag',
  ownPostComment: 'Ny kommentar på ditt oppslag',
  invitationReminder: 'Påminnelse om invitasjon',
  changesAndCancellations: 'Endringer og avlysninger',
} as const

export type NotificationPreferences = Record<keyof typeof notificationLabels, boolean>
export const defaultNotificationPreferences: NotificationPreferences = {
  familyEvent: true,
  noticeboardPost: true,
  ownPostComment: true,
  invitationReminder: true,
  changesAndCancellations: true,
}
