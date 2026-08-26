export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

type ProfileImageTarget = {
  familyId: string
  memberId?: string
}

const profileImageVersions = new Map<string, string>()
const profileImageVersionListeners = new Map<string, Set<() => void>>()

function getProfileImageTargetKey({ familyId, memberId }: ProfileImageTarget) {
  return memberId ? `${familyId}/${memberId}` : familyId
}

export function getProfileImageVersion(target: ProfileImageTarget) {
  return profileImageVersions.get(getProfileImageTargetKey(target))
}

export function subscribeToProfileImageVersion(target: ProfileImageTarget, listener: () => void) {
  const key = getProfileImageTargetKey(target)
  const listeners = profileImageVersionListeners.get(key) ?? new Set<() => void>()
  listeners.add(listener)
  profileImageVersionListeners.set(key, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) profileImageVersionListeners.delete(key)
  }
}

export function rememberProfileImageVersion(target: ProfileImageTarget, version: string) {
  const key = getProfileImageTargetKey(target)
  if (profileImageVersions.get(key) === version) return

  profileImageVersions.set(key, version)
  profileImageVersionListeners.get(key)?.forEach((listener) => listener())
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: unknown }
    return typeof body.message === 'string' ? body.message : fallback
  } catch {
    return fallback
  }
}

export function getProfileImageUrl({ familyId, memberId }: ProfileImageTarget, version?: string) {
  const search = new URLSearchParams({ familyId })
  if (memberId) search.set('memberId', memberId)
  if (version) search.set('v', version)
  return `/.netlify/functions/profile-image?${search.toString()}`
}

export async function uploadProfileImage({ familyId, memberId }: ProfileImageTarget, image: File) {
  const search = new URLSearchParams({ familyId })
  if (memberId) search.set('memberId', memberId)
  const formData = new FormData()
  formData.set('image', image)

  const response = await fetch(`/.netlify/functions/upload-profile-image?${search.toString()}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Bildet kunne ikke lastes opp. Prøv igjen.'))
  }

  const body = await response.json() as { updatedAt?: unknown }
  if (typeof body.updatedAt !== 'string') {
    throw new Error('Bildet kunne ikke lastes opp. Prøv igjen.')
  }
  rememberProfileImageVersion({ familyId, memberId }, body.updatedAt)
  return body.updatedAt
}
