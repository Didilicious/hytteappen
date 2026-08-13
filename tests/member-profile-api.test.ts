import { describe, expect, it, vi } from 'vitest'
import { getFamily } from '../shared/families'
import type { MemberProfile } from '../shared/memberProfiles'
import { validateMemberProfileInput } from '../netlify/functions/_shared/member-profile-input.mts'
import { createReadFamilyProfileFunction } from '../netlify/functions/read-family-profile.mts'
import { createUpdateMemberProfileFunction } from '../netlify/functions/update-member-profile.mts'

const heidi = { id: 'heidi', displayName: 'Heidi' }
const christine = { id: 'christine', displayName: 'Christine' }

function updateRequest(familyId: string, memberId: string, body: unknown) {
  return new Request(
    `https://example.com/.netlify/functions/update-member-profile?familyId=${familyId}&memberId=${memberId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

const contactInput = {
  phones: [
    { id: 'phone-1', label: ' Mobil ', value: ' +47 123 45 678 ' },
    { id: 'phone-2', label: '', value: '22 33 44 55' },
  ],
  emails: [
    { id: 'email-1', label: ' Privat ', value: ' heidi@example.no ' },
    { id: 'email-2', label: '', value: 'jobb@example.no' },
  ],
  addresses: [
    { id: 'address-1', label: ' Hos mamma ', value: ' Eksempelveien 12\n0123 Oslo ' },
    { id: 'address-2', label: '', value: 'Fjellveien 7\n0456 Oslo' },
  ],
}

describe('family profile read endpoint', () => {
  it('allows every authenticated family to view all member contact information', async () => {
    const loadMemberProfile = vi.fn(async (familyId: string, memberId: string): Promise<MemberProfile> => ({
      familyId,
      memberId,
      phones: [],
      emails: [],
      addresses: [],
      updatedAt: null,
    }))

    for (const user of [heidi, christine]) {
      const handler = createReadFamilyProfileFunction({ authenticate: () => user, loadMemberProfile })
      const response = await handler(new Request('https://example.com/.netlify/functions/read-family-profile?familyId=anette'))
      const body = await response.json() as { profiles: MemberProfile[] }

      expect(response.status).toBe(200)
      expect(body.profiles.map((profile) => profile.memberId)).toEqual(['anette', 'trond', 'caroline', 'pernille', 'oscar'])
    }
  })

  it('requires authentication and handles unknown families safely', async () => {
    const unauthenticated = createReadFamilyProfileFunction({ authenticate: () => null })
    const authenticated = createReadFamilyProfileFunction({ authenticate: () => heidi })

    expect((await unauthenticated(new Request('https://example.com/.netlify/functions/read-family-profile?familyId=heidi'))).status).toBe(401)
    expect((await authenticated(new Request('https://example.com/.netlify/functions/read-family-profile?familyId=unknown'))).status).toBe(404)
  })
})

describe('member profile update endpoint', () => {
  it('lets the owner family edit its own member with multiple contact values', async () => {
    const saveProfile = vi.fn()
    const handler = createUpdateMemberProfileFunction({
      authenticate: () => heidi,
      saveProfile,
      now: () => '2026-08-13T12:00:00.000Z',
    })

    const response = await handler(updateRequest('heidi', 'aurora', contactInput))
    const body = await response.json() as { profile: MemberProfile }

    expect(response.status).toBe(200)
    expect(body.profile).toEqual({
      familyId: 'heidi',
      memberId: 'aurora',
      phones: [
        { id: 'phone-1', label: 'Mobil', value: '+47 123 45 678' },
        { id: 'phone-2', label: '', value: '22 33 44 55' },
      ],
      emails: [
        { id: 'email-1', label: 'Privat', value: 'heidi@example.no' },
        { id: 'email-2', label: '', value: 'jobb@example.no' },
      ],
      addresses: [
        { id: 'address-1', label: 'Hos mamma', value: 'Eksempelveien 12\n0123 Oslo' },
        { id: 'address-2', label: '', value: 'Fjellveien 7\n0456 Oslo' },
      ],
      updatedAt: '2026-08-13T12:00:00.000Z',
    })
    expect(saveProfile).toHaveBeenCalledWith(body.profile)
  })

  it('returns 403 when another family attempts an edit', async () => {
    const saveProfile = vi.fn()
    const handler = createUpdateMemberProfileFunction({ authenticate: () => christine, saveProfile })

    const response = await handler(updateRequest('heidi', 'aurora', contactInput))

    expect(response.status).toBe(403)
    expect(saveProfile).not.toHaveBeenCalled()
  })

  it('cannot bypass ownership by mixing family and member IDs', async () => {
    const saveProfile = vi.fn()
    const handler = createUpdateMemberProfileFunction({ authenticate: () => heidi, saveProfile })

    expect((await handler(updateRequest('heidi', 'christine', contactInput))).status).toBe(404)
    expect((await handler(updateRequest('christine', 'christine', contactInput))).status).toBe(403)
    expect(saveProfile).not.toHaveBeenCalled()
  })

  it('removes individual and all contact entries without removing the member', async () => {
    const saveProfile = vi.fn()
    const handler = createUpdateMemberProfileFunction({ authenticate: () => heidi, saveProfile })
    const response = await handler(updateRequest('heidi', 'aurora', {
      phones: [contactInput.phones[1]],
      emails: [],
      addresses: [],
    }))
    const body = await response.json() as { profile: MemberProfile }

    expect(body.profile.phones).toEqual([{ id: 'phone-2', label: '', value: '22 33 44 55' }])
    expect(body.profile.emails).toEqual([])
    expect(body.profile.addresses).toEqual([])
    expect(getFamily('heidi')?.members.some((member) => member.id === 'aurora')).toBe(true)
  })

  it('returns 404 for an unknown member', async () => {
    const handler = createUpdateMemberProfileFunction({ authenticate: () => heidi, saveProfile: vi.fn() })
    expect((await handler(updateRequest('heidi', 'ukjent', contactInput))).status).toBe(404)
  })
})

describe('member profile validation', () => {
  it('drops completely blank entries and trims labels and values', () => {
    const result = validateMemberProfileInput({
      phones: [{ id: 'blank', label: '   ', value: '  ' }, contactInput.phones[0]],
      emails: [],
      addresses: [],
    })

    expect(result).toEqual({
      ok: true,
      value: {
        phones: [{ id: 'phone-1', label: 'Mobil', value: '+47 123 45 678' }],
        emails: [],
        addresses: [],
      },
    })
  })

  it('accepts optional labels, flexible phone formatting, and multiline addresses', () => {
    const result = validateMemberProfileInput(contactInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.phones[1].label).toBe('')
      expect(result.value.addresses[0].value).toBe('Eksempelveien 12\n0123 Oslo')
    }
  })

  it('rejects invalid email addresses and label-only entries', () => {
    expect(validateMemberProfileInput({ phones: [], emails: [{ id: 'bad', label: '', value: 'ikke-en-epost' }], addresses: [] }).ok).toBe(false)
    expect(validateMemberProfileInput({ phones: [{ id: 'bad', label: 'Mobil', value: ' ' }], emails: [], addresses: [] }).ok).toBe(false)
  })
})
