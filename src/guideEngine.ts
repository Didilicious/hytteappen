import type { GuideContent } from '../shared/guideContent'
import type { GuideDefinition } from './guideData'

export type GuideAnswers = Record<string, string>
export type InstructionStatus = 'completed' | 'skipped'
export type InstructionProgress = Record<string, InstructionStatus>

const warnedMessages = new Set<string>()

function warnOnce(message: string) {
  if (warnedMessages.has(message)) return
  warnedMessages.add(message)
  console.warn(message)
}

function getGuidePages(guide: GuideDefinition, content: readonly GuideContent[]) {
  return content.filter((page) => page.guides.includes(guide.name))
}

function findCircularAfterIds(parentById: Map<string, string>) {
  const circularIds = new Set<string>()

  for (const startId of parentById.keys()) {
    const path: string[] = []
    const pathIndexes = new Map<string, number>()
    let currentId: string | undefined = startId

    while (currentId && parentById.has(currentId)) {
      const cycleStart = pathIndexes.get(currentId)
      if (cycleStart !== undefined) {
        path.slice(cycleStart).forEach((id) => circularIds.add(id))
        break
      }
      pathIndexes.set(currentId, path.length)
      path.push(currentId)
      currentId = parentById.get(currentId)
    }
  }

  return circularIds
}

export function orderGuidePages(guide: GuideDefinition, content: readonly GuideContent[]) {
  const pages = getGuidePages(guide, content)
  const pageById = new Map(pages.map((page) => [page.id, page]))
  const parentById = new Map<string, string>()

  for (const page of pages) {
    if (!page.afterId) continue
    if (!pageById.has(page.afterId)) {
      warnOnce(`Guide row "${page.id}" references missing Etter ID "${page.afterId}" in ${guide.name}. Using Sheet order.`)
      continue
    }
    parentById.set(page.id, page.afterId)
  }

  const circularIds = findCircularAfterIds(parentById)
  if (circularIds.size > 0) {
    warnOnce(`Circular Etter references in ${guide.name}: ${[...circularIds].join(', ')}. Using Sheet order for those rows.`)
    circularIds.forEach((id) => parentById.delete(id))
  }

  const childrenById = new Map<string, GuideContent[]>()
  for (const page of pages) {
    const parentId = parentById.get(page.id)
    if (!parentId) continue
    const children = childrenById.get(parentId) ?? []
    children.push(page)
    childrenById.set(parentId, children)
  }

  const ordered: GuideContent[] = []
  const appendPage = (page: GuideContent) => {
    ordered.push(page)
    childrenById.get(page.id)?.forEach(appendPage)
  }

  pages.filter((page) => !parentById.has(page.id)).forEach(appendPage)
  return ordered
}

function areAnswerRequirementsMet(
  page: GuideContent,
  pagesById: Map<string, GuideContent>,
  answers: GuideAnswers,
) {
  return page.answerRequirements.every((requirement) => {
    const question = pagesById.get(requirement.questionId)
    if (!question || question.type !== 'question') {
      warnOnce(`Guide row "${page.id}" has an invalid Krever svar question ID "${requirement.questionId}". Ignoring that requirement.`)
      return true
    }
    if (!question.answerOptions.includes(requirement.answer)) {
      warnOnce(`Guide row "${page.id}" requires an unknown answer for "${requirement.questionId}". Ignoring that requirement.`)
      return true
    }
    return answers[requirement.questionId] === requirement.answer
  })
}

function areStepRequirementsMet(
  page: GuideContent,
  pagesById: Map<string, GuideContent>,
  progress: InstructionProgress,
) {
  return page.requiredStepIds.every((requiredId) => {
    const requiredStep = pagesById.get(requiredId)
    if (!requiredStep || requiredStep.type !== 'step') {
      warnOnce(`Guide row "${page.id}" has an invalid Krever steg ID "${requiredId}". Ignoring that requirement.`)
      return true
    }
    return progress[requiredId] === 'completed'
  })
}

export function buildVisiblePages(
  guide: GuideDefinition,
  content: readonly GuideContent[],
  answers: GuideAnswers,
  progress: InstructionProgress,
) {
  const orderedPages = orderGuidePages(guide, content)
  const pagesById = new Map(orderedPages.map((page) => [page.id, page]))
  return orderedPages.filter((page) => (
    areAnswerRequirementsMet(page, pagesById, answers)
      && areStepRequirementsMet(page, pagesById, progress)
  ))
}

export function getQuestionStatus(selectedAnswer?: string) {
  return selectedAnswer ? `Valgt svar: ${selectedAnswer}` : 'Ikke besvart'
}

export function getInstructionStatus(nodeId: string, progress: InstructionProgress) {
  if (progress[nodeId] === 'completed') return 'Ferdig'
  if (progress[nodeId] === 'skipped') return 'Hoppet over'
  return 'Ikke sett'
}
