import {
  familyEventTypeLabels,
  isFamilyEventType,
  type FamilyEvent,
  type FamilyEventType,
} from '../shared/familyEvents'
import { getFamilyMember } from '../shared/familyMembers'
import { parseLocalDate } from './calendar'

export type { FamilyEvent, FamilyEventType }
export { familyEventTypeLabels }

export const familyEventIconNames: Record<FamilyEventType, string> = {
  birthday: 'icon_event_birthday',
  'family-dinner': 'icon_event_dinner',
  'gingerbread-baking': 'icon_event_gingerbread',
  'woods-trip': 'icon_event_woods',
  other: 'icon_event_generic',
}

export const currentFamilyEventIconNames = Object.values(familyEventIconNames)

export function normalizeFamilyEvent(value: unknown): FamilyEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<FamilyEvent>

  if (
    typeof event.id !== 'string'
    || typeof event.ownerId !== 'string'
    || !isFamilyEventType(event.eventType)
    || typeof event.title !== 'string'
    || typeof event.startDate !== 'string'
    || (event.endDate !== null && typeof event.endDate !== 'string')
    || typeof event.startTime !== 'string'
    || typeof event.endTime !== 'string'
    || typeof event.location !== 'string'
    || typeof event.wishlistUrl !== 'string'
    || typeof event.moreInfo !== 'string'
    || typeof event.createdAt !== 'string'
    || typeof event.updatedAt !== 'string'
  ) return null

  return event as FamilyEvent
}

export function getFamilyEventsForDate(events: FamilyEvent[], dateKey: string) {
  return events
    .filter((event) => event.startDate <= dateKey && (event.endDate ?? event.startDate) >= dateKey)
    .sort((first, second) => (
      first.startTime.localeCompare(second.startTime)
      || first.title.localeCompare(second.title, 'nb-NO')
    ))
}

export function hasFamilyEventsInMonth(events: FamilyEvent[], firstDate: string, lastDate: string) {
  return events.some((event) => event.startDate <= lastDate && (event.endDate ?? event.startDate) >= firstDate)
}

const dateFormatter = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatFamilyEventDate(dateKey: string) {
  const date = parseLocalDate(dateKey)
  return date ? dateFormatter.format(date) : dateKey
}

export function formatFamilyEventDateRange(event: Pick<FamilyEvent, 'startDate' | 'endDate'>) {
  if (!event.endDate || event.endDate === event.startDate) return formatFamilyEventDate(event.startDate)
  return `${formatFamilyEventDate(event.startDate)}–${formatFamilyEventDate(event.endDate)}`
}

export function formatFamilyEventTime(event: Pick<FamilyEvent, 'startTime' | 'endTime'>) {
  if (!event.startTime) return ''
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime
}

export function getFamilyEventOwnerName(ownerId: string) {
  return getFamilyMember(ownerId)?.displayName ?? 'Ukjent familie'
}
