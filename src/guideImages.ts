import type { GuideContent, GuideContentId } from '../shared/guideContent'
import type { GuideImage, GuideImagesResponse } from '../shared/guideImages'

export type GuideImagesLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; imagesByGroup: Record<string, GuideImage[]> }
  | { status: 'error' }

let guideImagesPromise: Promise<Record<string, GuideImage[]>> | undefined

export function collectImageGroups(contentById: Record<GuideContentId, GuideContent>) {
  return [...new Set(
    Object.values(contentById)
      .map((content) => content.imageGroup?.trim())
      .filter((group): group is string => Boolean(group)),
  )]
}

function isGuideImage(value: unknown): value is GuideImage {
  if (!value || typeof value !== 'object') return false
  const image = value as Partial<GuideImage>
  return typeof image.name === 'string' && typeof image.src === 'string'
}

function readImagesResponse(value: unknown, groups: readonly string[]) {
  const response = value as Partial<GuideImagesResponse> | null
  if (!response?.imagesByGroup || typeof response.imagesByGroup !== 'object') return null

  for (const group of groups) {
    const images = response.imagesByGroup[group]
    if (!Array.isArray(images) || images.some((image) => !isGuideImage(image))) return null
  }

  return response.imagesByGroup as Record<string, GuideImage[]>
}

export function loadGuideImages(contentById: Record<GuideContentId, GuideContent>) {
  if (!guideImagesPromise) {
    const groups = collectImageGroups(contentById)

    if (groups.length === 0) {
      guideImagesPromise = Promise.resolve({})
    } else {
      const searchParams = new URLSearchParams()
      groups.forEach((group) => searchParams.append('group', group))

      guideImagesPromise = fetch(`/.netlify/functions/guide-images?${searchParams}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }).then(async (response) => {
        if (!response.ok) throw new Error('Guide images request failed')

        const imagesByGroup = readImagesResponse(await response.json(), groups)
        if (!imagesByGroup) throw new Error('Invalid guide images response')
        return imagesByGroup
      })
    }
  }

  return guideImagesPromise
}
