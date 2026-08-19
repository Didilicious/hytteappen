import type { GuideContent } from '../shared/guideContent'
import type { GuideImage, GuideImagesResponse } from '../shared/guideImages'

export type GuideImagesLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; imagesByGroup: Record<string, GuideImage[]> }
  | { status: 'error' }

let guideImagesPromise: Promise<Record<string, GuideImage[]>> | undefined

export function collectImageGroups(content: readonly GuideContent[]) {
  return [...new Set(
    content
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

function readIconsResponse(value: unknown, iconNames: readonly string[]) {
  const response = value as Partial<GuideImagesResponse> | null
  if (!response?.iconsByName || typeof response.iconsByName !== 'object') return null

  for (const iconName of iconNames) {
    const icon = response.iconsByName[iconName]
    if (icon !== null && !isGuideImage(icon)) return null
  }

  return response.iconsByName as Record<string, GuideImage | null>
}

function requestDriveImages(searchParams: URLSearchParams) {
  return fetch(`/.netlify/functions/guide-images?${searchParams}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

export function loadGuideImages(content: readonly GuideContent[]) {
  if (!guideImagesPromise) {
    const groups = collectImageGroups(content)

    if (groups.length === 0) {
      guideImagesPromise = Promise.resolve({})
    } else {
      const searchParams = new URLSearchParams()
      groups.forEach((group) => searchParams.append('group', group))

      guideImagesPromise = requestDriveImages(searchParams).then(async (response) => {
        if (!response.ok) throw new Error('Guide images request failed')

        const imagesByGroup = readImagesResponse(await response.json(), groups)
        if (!imagesByGroup) throw new Error('Invalid guide images response')
        return imagesByGroup
      })
    }
  }

  return guideImagesPromise
}

const homeIconsPromises = new Map<string, Promise<Record<string, GuideImage | null>>>()

export function loadHomeIcons(iconNames: readonly string[]) {
  const uniqueIconNames = [...new Set(iconNames)]
  const cacheKey = [...uniqueIconNames].sort().join('\n')
  let iconsPromise = homeIconsPromises.get(cacheKey)

  if (!iconsPromise) {
    const searchParams = new URLSearchParams()
    uniqueIconNames.forEach((iconName) => searchParams.append('icon', iconName))

    iconsPromise = requestDriveImages(searchParams).then(async (response) => {
      if (!response.ok) throw new Error('Home icons request failed')

      const iconsByName = readIconsResponse(await response.json(), uniqueIconNames)
      if (!iconsByName) throw new Error('Invalid home icons response')
      return iconsByName
    })
    homeIconsPromises.set(cacheKey, iconsPromise)
  }

  return iconsPromise
}
