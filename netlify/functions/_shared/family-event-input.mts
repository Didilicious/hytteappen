import { isFamilyEventType, type FamilyEvent } from '../../../shared/familyEvents.ts'

export type FamilyEventInput = {
  eventType?: unknown
  title?: unknown
  startDate?: unknown
  endDate?: unknown
  startTime?: unknown
  endTime?: unknown
  location?: unknown
  wishlistUrl?: unknown
  moreInfo?: unknown
}

type FamilyEventMetadata = {
  id: string
  ownerId: string
  timestamp: string
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

function optionalText(value: unknown, maxLength: number) {
  const normalized = typeof value === 'string' ? value.trim() : value ?? ''
  return typeof normalized === 'string' && normalized.length <= maxLength ? normalized : null
}

function validateFamilyEventInput(input: FamilyEventInput) {
  const title = optionalText(input.title, 200)
  const startTime = optionalText(input.startTime, 5)
  const endTime = optionalText(input.endTime, 5)
  const location = optionalText(input.location, 500)
  const wishlistUrl = optionalText(input.wishlistUrl, 2000)
  const moreInfo = optionalText(input.moreInfo, 3000)
  const endDate = input.endDate === null || input.endDate === undefined || input.endDate === ''
    ? null
    : input.endDate

  if (
    !isFamilyEventType(input.eventType)
    || !title
    || typeof input.startDate !== 'string'
    || !datePattern.test(input.startDate)
    || (endDate !== null && (typeof endDate !== 'string' || !datePattern.test(endDate)))
    || (typeof endDate === 'string' && endDate < input.startDate)
    || startTime === null
    || (startTime !== '' && !timePattern.test(startTime))
    || endTime === null
    || (endTime !== '' && !timePattern.test(endTime))
    || (endTime !== '' && startTime === '')
    || (
      startTime !== ''
      && endTime !== ''
      && (endDate === null || endDate === input.startDate)
      && endTime < startTime
    )
    || location === null
    || wishlistUrl === null
    || moreInfo === null
  ) return null

  if (wishlistUrl) {
    try {
      const url = new URL(wishlistUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    } catch {
      return null
    }
  }

  return {
    eventType: input.eventType,
    title,
    startDate: input.startDate,
    endDate,
    startTime,
    endTime,
    location,
    wishlistUrl,
    moreInfo,
  }
}

export function prepareFamilyEvent(input: FamilyEventInput, metadata: FamilyEventMetadata): FamilyEvent | null {
  const values = validateFamilyEventInput(input)
  if (!values) return null

  return {
    id: metadata.id,
    ownerId: metadata.ownerId,
    ...values,
    createdAt: metadata.timestamp,
    updatedAt: metadata.timestamp,
  }
}

export function prepareFamilyEventUpdate(
  input: FamilyEventInput,
  existing: FamilyEvent,
  timestamp: string,
): FamilyEvent | null {
  const values = validateFamilyEventInput(input)
  if (!values) return null

  return { ...existing, ...values, updatedAt: timestamp }
}
