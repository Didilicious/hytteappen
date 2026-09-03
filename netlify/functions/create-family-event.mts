import { randomUUID } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { prepareFamilyEvent, type FamilyEventInput } from './_shared/family-event-input.mts'
import { createFamilyEvent } from './_shared/family-events.mts'
import { clearSessionCookie, getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

export default async function createFamilyEventFunction(request: Request) {
  if (request.method !== 'POST') return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })

  try {
    const familyMember = getAuthenticatedFamilyMember(request)
    if (!familyMember) {
      return jsonResponse(
        { message: 'Økten har utløpt. Logg inn på nytt.' },
        { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
      )
    }

    const timestamp = new Date().toISOString()
    const event = prepareFamilyEvent(await request.json() as FamilyEventInput, {
      id: randomUUID(),
      ownerId: familyMember.id,
      timestamp,
    })
    if (!event) return jsonResponse({ message: 'Kontroller opplysningene og prøv igjen.' }, { status: 400 })

    await createFamilyEvent(event)
    return jsonResponse({ event }, { status: 201 })
  } catch {
    return jsonResponse({ message: 'Kunne ikke lagre arrangementet. Prøv igjen.' }, { status: 500 })
  }
}

export const config: Config = { method: 'POST' }
