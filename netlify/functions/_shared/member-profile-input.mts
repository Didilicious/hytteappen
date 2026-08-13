import { randomUUID } from 'node:crypto'
import type { ContactEntry, MemberProfileInput } from '../../../shared/memberProfiles.ts'

type ValidationResult =
  | { ok: true; value: MemberProfileInput }
  | { ok: false; message: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEntries(value: unknown, kind: 'phone' | 'email' | 'address'): ContactEntry[] | null {
  if (!Array.isArray(value)) return null

  const entries: ContactEntry[] = []
  const ids = new Set<string>()

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') return null

    const entry = candidate as { id?: unknown; label?: unknown; value?: unknown }
    if (entry.label !== undefined && typeof entry.label !== 'string') return null
    if (typeof entry.value !== 'string') return null

    const label = typeof entry.label === 'string' ? entry.label.trim() : ''
    const normalizedValue = entry.value.trim()
    if (!label && !normalizedValue) continue
    if (!normalizedValue) return null
    if (kind === 'email' && !emailPattern.test(normalizedValue)) return null

    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : randomUUID()
    if (ids.has(id)) return null
    ids.add(id)
    entries.push({ id, label, value: normalizedValue })
  }

  return entries
}

export function validateMemberProfileInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Kontroller kontaktopplysningene og prøv igjen.' }
  }

  const candidate = input as Partial<MemberProfileInput>
  const phones = normalizeEntries(candidate.phones, 'phone')
  const emails = normalizeEntries(candidate.emails, 'email')
  const addresses = normalizeEntries(candidate.addresses, 'address')

  if (!phones || !emails || !addresses) {
    return { ok: false, message: 'Kontroller kontaktopplysningene og prøv igjen.' }
  }

  return { ok: true, value: { phones, emails, addresses } }
}
