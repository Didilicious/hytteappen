import type { GuideDefinition, GuideNode, GuideOption, QuestionNode } from './guideData'

export type GuideAnswers = Record<string, string>
export type InstructionStatus = 'completed' | 'skipped'
export type InstructionProgress = Record<string, InstructionStatus>

export function getSelectedOption(
  node: QuestionNode,
  answers: GuideAnswers,
): GuideOption | undefined {
  const answerId = answers[node.id]
  return node.options.find((option) => option.id === answerId && !option.disabled)
}

export function getNextNodeId(node: GuideNode, answers: GuideAnswers) {
  if (node.type === 'question') {
    return getSelectedOption(node, answers)?.nextNodeId
  }

  return node.nextNodeId
}

export function buildActivePath(guide: GuideDefinition, answers: GuideAnswers) {
  const path: GuideNode[] = []
  const visited = new Set<string>()
  let nodeId: string | undefined = guide.startNodeId

  while (nodeId && !visited.has(nodeId)) {
    const node = guide.nodes[nodeId]

    if (!node) break

    path.push(node)
    visited.add(nodeId)
    nodeId = getNextNodeId(node, answers)
  }

  return path
}

export function getLogicalPreviousNodeId(
  guide: GuideDefinition,
  answers: GuideAnswers,
  currentNodeId: string,
) {
  const activePath = buildActivePath(guide, answers)
  const currentIndex = activePath.findIndex((node) => node.id === currentNodeId)
  return currentIndex > 0 ? activePath[currentIndex - 1].id : undefined
}

export function getQuestionStatus(node: QuestionNode, answers: GuideAnswers) {
  const selectedOption = getSelectedOption(node, answers)
  return selectedOption ? `Valgt svar: ${selectedOption.label}` : 'Ikke besvart'
}

export function getInstructionStatus(
  nodeId: string,
  progress: InstructionProgress,
) {
  if (progress[nodeId] === 'completed') return 'Ferdig'
  if (progress[nodeId] === 'skipped') return 'Hoppet over'
  return 'Ikke sett'
}
