import { getStore } from '@netlify/blobs'
import sharp from 'sharp'

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_IMAGE_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'] as const

export type ProfileImageTarget = {
  familyId: string
  memberId?: string
}

export type StoredProfileImage = {
  data: ArrayBuffer
  contentType: string
  etag?: string
}

const profileImageStore = () => getStore({ name: 'profile-images', consistency: 'strong' })

export function getProfileImageKey({ familyId, memberId }: ProfileImageTarget) {
  return memberId ? `members/${familyId}/${memberId}` : `families/${familyId}`
}

function hasSupportedSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
  }

  if (contentType === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }

  return false
}

export async function prepareProfileImage(file: File) {
  if (!PROFILE_IMAGE_ACCEPT.includes(file.type as typeof PROFILE_IMAGE_ACCEPT[number])) {
    throw new Error('UNSUPPORTED_TYPE')
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  const source = new Uint8Array(await file.arrayBuffer())
  if (!hasSupportedSignature(source, file.type)) {
    throw new Error('UNSUPPORTED_TYPE')
  }

  try {
    const output = await sharp(source)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer()

    return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer
  } catch {
    throw new Error('INVALID_IMAGE')
  }
}

export async function saveProfileImage(target: ProfileImageTarget, data: ArrayBuffer, updatedAt: string) {
  await profileImageStore().set(getProfileImageKey(target), data, {
    metadata: { contentType: 'image/webp', updatedAt },
  })
}

export async function readProfileImage(target: ProfileImageTarget): Promise<StoredProfileImage | null> {
  const result = await profileImageStore().getWithMetadata(getProfileImageKey(target), { type: 'arrayBuffer' })
  if (!result) return null

  return {
    data: result.data,
    contentType: typeof result.metadata.contentType === 'string' ? result.metadata.contentType : 'image/webp',
    etag: result.etag,
  }
}
