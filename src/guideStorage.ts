import { useMemo, useSyncExternalStore } from 'react'
import type { GuideAnswers, InstructionProgress, InstructionStatus } from './guideEngine'

const storageEventName = 'hytteguiden-guide-state-change'

function answersStorageKey(guideId: string) {
  return `hytteguiden:${guideId}:answers`
}

function progressStorageKey(guideId: string) {
  return `hytteguiden:${guideId}:instruction-progress`
}

function readStorage(key: string) {
  return localStorage.getItem(key) ?? '{}'
}

function parseRecord<Value>(value: string): Record<string, Value> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function notifyGuideStateChanged() {
  window.dispatchEvent(new Event(storageEventName))
}

function subscribe(callback: () => void) {
  window.addEventListener(storageEventName, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(storageEventName, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useGuideState(guideId: string) {
  const answerKey = answersStorageKey(guideId)
  const progressKey = progressStorageKey(guideId)
  const answersJson = useSyncExternalStore(
    subscribe,
    () => readStorage(answerKey),
    () => '{}',
  )
  const progressJson = useSyncExternalStore(
    subscribe,
    () => readStorage(progressKey),
    () => '{}',
  )

  const answers = useMemo(() => parseRecord<string>(answersJson) as GuideAnswers, [answersJson])
  const progress = useMemo(
    () => parseRecord<InstructionStatus>(progressJson) as InstructionProgress,
    [progressJson],
  )

  function saveAnswer(nodeId: string, optionId: string) {
    localStorage.setItem(answerKey, JSON.stringify({ ...answers, [nodeId]: optionId }))
    notifyGuideStateChanged()
  }

  function saveInstructionStatus(nodeId: string, status?: InstructionStatus) {
    const nextProgress = { ...progress }

    if (status) {
      nextProgress[nodeId] = status
    } else {
      delete nextProgress[nodeId]
    }

    localStorage.setItem(progressKey, JSON.stringify(nextProgress))
    notifyGuideStateChanged()
  }

  function resetGuideState() {
    localStorage.removeItem(answerKey)
    localStorage.removeItem(progressKey)
    notifyGuideStateChanged()
  }

  return { answers, progress, saveAnswer, saveInstructionStatus, resetGuideState }
}
