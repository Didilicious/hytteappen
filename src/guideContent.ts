import {
  guideContentIds,
  type GuideContent,
  type GuideContentId,
  type GuideContentResponse,
} from '../shared/guideContent'

export type GuideContentLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; contentById: Record<GuideContentId, GuideContent> }
  | { status: 'error'; kind: 'load' | 'configuration' }

let guideContentPromise: Promise<Record<GuideContentId, GuideContent>> | undefined

function isGuideContent(value: unknown): value is GuideContent {
  if (!value || typeof value !== 'object') return false
  const content = value as Partial<GuideContent>
  return typeof content.id === 'string'
    && typeof content.title === 'string'
    && Array.isArray(content.guides)
    && Array.isArray(content.instructions)
    && Array.isArray(content.answerOptions)
    && Array.isArray(content.answerRequirements)
    && typeof content.canSkip === 'boolean'
}

function readContentResponse(value: unknown) {
  const response = value as Partial<GuideContentResponse> | null
  if (!response?.contentById || typeof response.contentById !== 'object') return null

  for (const id of guideContentIds) {
    if (!isGuideContent(response.contentById[id]) || response.contentById[id].id !== id) return null
  }

  return response.contentById as Record<GuideContentId, GuideContent>
}

export function loadGuideContent() {
  if (!guideContentPromise) {
    guideContentPromise = fetch('/.netlify/functions/guide-content', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(async (response) => {
      if (!response.ok) {
        const error = new Error('Guide content request failed') as Error & { kind?: string }
        try {
          const body = await response.json() as { code?: unknown }
          error.kind = body.code === 'configuration_error' ? 'configuration' : 'load'
        } catch {
          error.kind = 'load'
        }
        throw error
      }

      const contentById = readContentResponse(await response.json())
      if (!contentById) {
        const error = new Error('Invalid guide content response') as Error & { kind?: string }
        error.kind = 'configuration'
        throw error
      }
      return contentById
    })
  }

  return guideContentPromise
}
