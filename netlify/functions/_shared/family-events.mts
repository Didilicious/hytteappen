import { getStore } from '@netlify/blobs'
import {
  isFamilyEventType,
  type FamilyEvent,
} from '../../../shared/familyEvents.ts'

function getFamilyEventsStore() {
  return getStore({ name: 'family-events', consistency: 'strong' })
}

export function normalizeStoredFamilyEvent(value: unknown): FamilyEvent | null {
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

export async function createFamilyEvent(event: FamilyEvent) {
  await getFamilyEventsStore().setJSON(event.id, event)
}

export async function updateFamilyEvent(event: FamilyEvent) {
  await getFamilyEventsStore().setJSON(event.id, event)
}

export async function deleteFamilyEvent(eventId: string) {
  await getFamilyEventsStore().delete(eventId)
}

export async function readFamilyEvent(eventId: string) {
  const storedEvent = await getFamilyEventsStore().get(eventId, { type: 'json' })
  return normalizeStoredFamilyEvent(storedEvent)
}

export async function readFamilyEvents() {
  const store = getFamilyEventsStore()
  const { blobs } = await store.list()
  const storedEvents = await Promise.all(
    blobs.map(({ key }) => store.get(key, { type: 'json' })),
  )

  return storedEvents
    .map(normalizeStoredFamilyEvent)
    .filter((event): event is FamilyEvent => event !== null)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
}
