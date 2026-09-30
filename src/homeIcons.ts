export const homeIconNames = {
  openCabin: 'icon_cabin_open',
  closeCabin: 'icon_cabin_locked',
  booking: 'icon_calendar',
  food: 'icon_food',
  operations: 'icon_cabin',
  troubleshooting: 'icon_errorHandling',
  noticeboard: 'icon_noticeboard',
  family: 'icon_family',
} as const

export const currentHomeIconNames = [
  homeIconNames.openCabin,
  homeIconNames.closeCabin,
  homeIconNames.booking,
  homeIconNames.food,
  homeIconNames.operations,
  homeIconNames.troubleshooting,
  homeIconNames.noticeboard,
  homeIconNames.family,
] as const
