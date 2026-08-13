export const homeIconNames = {
  openCabin: 'icon_cabin_open',
  closeCabin: 'icon_cabin_locked',
  booking: 'icon_calendar',
  food: 'icon_food',
  operations: 'icon_cabin',
  noticeboard: 'icon_noticeboard',
} as const

export const currentHomeIconNames = [
  homeIconNames.openCabin,
  homeIconNames.closeCabin,
  homeIconNames.booking,
  homeIconNames.food,
  homeIconNames.operations,
] as const
