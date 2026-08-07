import type { GuideContent, GuideContentId, GuideName } from '../shared/guideContent'
import type { GuideAnswers } from './guideEngine'
import { buildActivePath, getSelectedOption } from './guideEngine'
import type { GuideDefinition, GuideNode, QuestionNode } from './guideData'

export type GuideContentMap = Record<GuideContentId, GuideContent>

const guideNames: Record<string, GuideName> = {
  'open-cabin': 'Åpne',
  'close-cabin': 'Stenge',
  'cabin-operations': 'Drift',
}

export function getContentForNode(node: GuideNode, contentById: GuideContentMap) {
  return node.contentId ? contentById[node.contentId] : undefined
}

export function getNodeTitle(node: GuideNode, contentById: GuideContentMap) {
  return node.type === 'completion' ? node.title : contentById[node.contentId].title
}

export function getSelectedAnswerLabel(
  node: QuestionNode,
  answers: GuideAnswers,
  contentById: GuideContentMap,
) {
  const selectedOption = getSelectedOption(node, answers)
  const selectedIndex = selectedOption ? node.options.indexOf(selectedOption) : -1
  return selectedIndex >= 0 ? contentById[node.contentId].answerOptions[selectedIndex] : undefined
}

export function areAnswerRequirementsMet(
  guide: GuideDefinition,
  node: GuideNode,
  answers: GuideAnswers,
  contentById: GuideContentMap,
) {
  const content = getContentForNode(node, contentById)
  if (!content) return true

  return content.answerRequirements.every((requirement) => {
    const question = Object.values(guide.nodes).find(
      (candidate): candidate is QuestionNode => candidate.type === 'question'
        && candidate.contentId === requirement.questionId,
    )
    return question
      ? getSelectedAnswerLabel(question, answers, contentById) === requirement.answer
      : false
  })
}

export function buildVisiblePath(
  guide: GuideDefinition,
  answers: GuideAnswers,
  contentById: GuideContentMap,
) {
  return buildActivePath(guide, answers).filter(
    (node) => areAnswerRequirementsMet(guide, node, answers, contentById),
  )
}

export function validateGuideContent(guide: GuideDefinition, contentById: GuideContentMap) {
  const expectedGuideName = guideNames[guide.id]

  for (const node of Object.values(guide.nodes)) {
    if (!node.contentId) continue

    const content = contentById[node.contentId]
    if (!content || !content.guides.includes(expectedGuideName)) return false
    if (node.type === 'question') {
      if (content.type !== 'question' || content.answerOptions.length !== node.options.length) return false
    } else if (node.type === 'instruction' && content.type !== 'step') {
      return false
    }

    for (const requirement of content.answerRequirements) {
      const requirementNode = Object.values(guide.nodes).find(
        (candidate) => candidate.type === 'question' && candidate.contentId === requirement.questionId,
      ) as QuestionNode | undefined
      if (!requirementNode) return false
      if (!contentById[requirementNode.contentId].answerOptions.includes(requirement.answer)) return false
    }
  }

  return true
}
