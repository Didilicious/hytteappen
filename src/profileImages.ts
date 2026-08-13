export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

type ProfileImageTarget = {
  familyId: string
  memberId?: string
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
  return body.updatedAt
}
