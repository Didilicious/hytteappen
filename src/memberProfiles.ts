import type { MemberProfile, MemberProfileInput } from '../shared/memberProfiles'

export type { ContactEntry, MemberProfile, MemberProfileInput } from '../shared/memberProfiles'

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: unknown }
    return typeof body.message === 'string' ? body.message : fallback
  } catch {
    return fallback
  }
}

export async function readFamilyProfiles(familyId: string, signal?: AbortSignal) {
  const response = await fetch(`/.netlify/functions/read-family-profile?familyId=${encodeURIComponent(familyId)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke hente kontaktinformasjonen.'))
  }

  const body = await response.json() as { profiles?: MemberProfile[] }
  return Array.isArray(body.profiles) ? body.profiles : []
}

export async function updateMemberProfile(familyId: string, memberId: string, input: MemberProfileInput) {
  const response = await fetch(
    `/.netlify/functions/update-member-profile?familyId=${encodeURIComponent(familyId)}&memberId=${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Kunne ikke lagre endringene. Prøv igjen.'))
  }

  const body = await response.json() as { profile?: MemberProfile }
  if (!body.profile) throw new Error('Kunne ikke lagre endringene. Prøv igjen.')
  return body.profile
}
