import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteBlob = vi.fn()
const setJSON = vi.fn()

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({ delete: deleteBlob, setJSON, get: vi.fn() }),
}))

import { saveMemberProfile } from '../netlify/functions/_shared/member-profiles.mts'

describe('member profile Blob storage', () => {
  beforeEach(() => {
    deleteBlob.mockReset()
    setJSON.mockReset()
  })

  it('does not create empty Blob records', async () => {
    await saveMemberProfile({
      familyId: 'heidi',
      memberId: 'aurora',
      phones: [],
      emails: [],
      addresses: [],
      updatedAt: '2026-08-13T12:00:00.000Z',
    })

    expect(deleteBlob).toHaveBeenCalledWith('heidi/aurora')
    expect(setJSON).not.toHaveBeenCalled()
  })

  it('stores multiple contact values in one member document', async () => {
    const profile = {
      familyId: 'heidi',
      memberId: 'aurora',
      phones: [{ id: 'p1', label: 'Mobil', value: '+47 123 45 678' }],
      emails: [{ id: 'e1', label: '', value: 'aurora@example.no' }],
      addresses: [{ id: 'a1', label: 'Hjemme', value: 'Veien 1\n0123 Oslo' }],
      updatedAt: '2026-08-13T12:00:00.000Z',
    }

    await saveMemberProfile(profile)

    expect(setJSON).toHaveBeenCalledWith('heidi/aurora', profile)
    expect(deleteBlob).not.toHaveBeenCalled()
  })
})
