import { describe, expect, it, vi } from 'vitest'
import { PROFILE_IMAGE_MAX_BYTES, prepareProfileImage } from '../netlify/functions/_shared/profile-images.mts'
import { createReadProfileImageFunction } from '../netlify/functions/profile-image.mts'
import { createUploadProfileImageFunction } from '../netlify/functions/upload-profile-image.mts'

const heidi = { id: 'heidi', displayName: 'Heidi' }
const christine = { id: 'christine', displayName: 'Christine' }
const preparedImage = new Uint8Array([9, 8, 7]).buffer

function imageFile(type = 'image/jpeg') {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], 'profil.jpg', { type })
}

function uploadRequest(familyId: string, memberId?: string, file = imageFile()) {
  const search = new URLSearchParams({ familyId })
  if (memberId) search.set('memberId', memberId)
  const formData = new FormData()
  formData.set('image', file)
  return new Request(`https://example.com/.netlify/functions/upload-profile-image?${search}`, {
    method: 'POST',
    body: formData,
  })
}

describe('profile image API', () => {
  it('allows authenticated users to view family and member images', async () => {
    const loadImage = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3]).buffer,
      contentType: 'image/webp',
      etag: 'image-etag',
    })
    const handler = createReadProfileImageFunction({ authenticate: () => christine, loadImage })

    const familyResponse = await handler(new Request(
      'https://example.com/.netlify/functions/profile-image?familyId=heidi',
    ))
    const memberResponse = await handler(new Request(
      'https://example.com/.netlify/functions/profile-image?familyId=heidi&memberId=aurora',
    ))

    expect(familyResponse.status).toBe(200)
    expect(familyResponse.headers.get('Content-Type')).toBe('image/webp')
    expect([...new Uint8Array(await familyResponse.arrayBuffer())]).toEqual([1, 2, 3])
    expect(memberResponse.status).toBe(200)
    expect(loadImage).toHaveBeenNthCalledWith(1, { familyId: 'heidi', memberId: undefined })
    expect(loadImage).toHaveBeenNthCalledWith(2, { familyId: 'heidi', memberId: 'aurora' })
  })

  it('rejects unauthenticated image access', async () => {
    const loadImage = vi.fn()
    const handler = createReadProfileImageFunction({ authenticate: () => null, loadImage })
    const response = await handler(new Request(
      'https://example.com/.netlify/functions/profile-image?familyId=heidi',
    ))

    expect(response.status).toBe(401)
    expect(loadImage).not.toHaveBeenCalled()
  })

  it('returns 404 when an authenticated user requests a missing image', async () => {
    const handler = createReadProfileImageFunction({
      authenticate: () => heidi,
      loadImage: vi.fn().mockResolvedValue(null),
    })

    expect((await handler(new Request(
      'https://example.com/.netlify/functions/profile-image?familyId=heidi',
    ))).status).toBe(404)
  })

  it('allows the owner family to upload its family picture', async () => {
    const saveImage = vi.fn().mockResolvedValue(undefined)
    const handler = createUploadProfileImageFunction({
      authenticate: () => heidi,
      prepareImage: vi.fn().mockResolvedValue(preparedImage),
      saveImage,
      now: () => '2026-08-13T12:00:00.000Z',
    })

    const response = await handler(uploadRequest('heidi'))

    expect(response.status).toBe(200)
    expect(saveImage).toHaveBeenCalledWith(
      { familyId: 'heidi', memberId: undefined },
      preparedImage,
      '2026-08-13T12:00:00.000Z',
    )
  })

  it('allows the owner family to upload a member picture', async () => {
    const saveImage = vi.fn().mockResolvedValue(undefined)
    const handler = createUploadProfileImageFunction({
      authenticate: () => heidi,
      prepareImage: vi.fn().mockResolvedValue(preparedImage),
      saveImage,
    })

    const response = await handler(uploadRequest('heidi', 'aurora'))

    expect(response.status).toBe(200)
    expect(saveImage).toHaveBeenCalledWith(
      { familyId: 'heidi', memberId: 'aurora' },
      preparedImage,
      expect.any(String),
    )
  })

  it('prevents another family from replacing family or member pictures', async () => {
    const saveImage = vi.fn()
    const handler = createUploadProfileImageFunction({
      authenticate: () => christine,
      prepareImage: vi.fn().mockResolvedValue(preparedImage),
      saveImage,
    })

    expect((await handler(uploadRequest('heidi'))).status).toBe(403)
    expect((await handler(uploadRequest('heidi', 'aurora'))).status).toBe(403)
    expect(saveImage).not.toHaveBeenCalled()
  })

  it('cannot bypass ownership by manipulating family and member IDs', async () => {
    const saveImage = vi.fn()
    const handler = createUploadProfileImageFunction({
      authenticate: () => heidi,
      prepareImage: vi.fn().mockResolvedValue(preparedImage),
      saveImage,
    })

    expect((await handler(uploadRequest('heidi', 'christine'))).status).toBe(404)
    expect((await handler(uploadRequest('christine', 'christine'))).status).toBe(403)
    expect(saveImage).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types', async () => {
    await expect(prepareProfileImage(new File(['not an image'], 'profil.gif', { type: 'image/gif' })))
      .rejects.toThrow('UNSUPPORTED_TYPE')
  })

  it('rejects oversized files', async () => {
    const oversized = new File(
      [new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1)],
      'profil.jpg',
      { type: 'image/jpeg' },
    )

    await expect(prepareProfileImage(oversized)).rejects.toThrow('FILE_TOO_LARGE')
  })

  it('replaces an existing image by saving to the same stable target', async () => {
    const saveImage = vi.fn().mockResolvedValue(undefined)
    const handler = createUploadProfileImageFunction({
      authenticate: () => heidi,
      prepareImage: vi.fn().mockResolvedValue(preparedImage),
      saveImage,
    })

    await handler(uploadRequest('heidi', 'aurora'))
    await handler(uploadRequest('heidi', 'aurora'))

    expect(saveImage).toHaveBeenCalledTimes(2)
    expect(saveImage.mock.calls[0][0]).toEqual({ familyId: 'heidi', memberId: 'aurora' })
    expect(saveImage.mock.calls[1][0]).toEqual({ familyId: 'heidi', memberId: 'aurora' })
  })
})
