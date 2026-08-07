import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GuideContent } from '../../shared/guideContent'
import GuideContentSections from '../components/GuideContentSections'
import GuideLayout from '../components/GuideLayout'
import type { GuideNode, InstructionNode, QuestionNode } from '../guideData'
import { guides } from '../guideData'
import { loadGuideContent, type GuideContentLoadState } from '../guideContent'
import {
  buildActivePath,
  getInstructionStatus,
  getQuestionStatus,
  getSelectedOption,
  type InstructionStatus,
} from '../guideEngine'
import {
  buildVisiblePath,
  getContentForNode,
  getNodeTitle,
  getSelectedAnswerLabel,
  validateGuideContent,
} from '../guideRequirements'
import { useGuideState } from '../guideStorage'

function GuideBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      <span aria-hidden="true">←</span>
      Tilbake
    </button>
  )
}

function getOverviewStatusClass(status: string) {
  if (status === 'Ferdig') return 'overview-status--completed'
  if (status === 'Hoppet over') return 'overview-status--skipped'
  return 'overview-status--neutral'
}

function ResetGuideDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    return () => {
      if (dialog?.open) {
        dialog.close()
      }
    }
  }, [])

  return (
    <dialog
      className="reset-dialog"
      ref={dialogRef}
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-description"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="reset-dialog__content">
        <p className="eyebrow">Start på nytt</p>
        <h2 id="reset-dialog-title">Nullstill all fremdrift?</h2>
        <p id="reset-dialog-description">
          Dette vil slette alle svar, markeringer og fremdrift for denne guiden.
        </p>
        <div className="reset-dialog__actions">
          <button className="secondary-button" type="button" onClick={onCancel} autoFocus>
            Avbryt
          </button>
          <button className="primary-button" type="button" onClick={onConfirm}>
            Nullstill
          </button>
        </div>
      </div>
    </dialog>
  )
}

function QuestionContent({
  content,
  node,
  onAnswer,
  selectedOptionId,
}: {
  content: GuideContent
  node: QuestionNode
  onAnswer: (optionId: string, nextNodeId: string) => void
  selectedOptionId?: string
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <GuideContentSections content={content} />
      <div className="option-list">
        {node.options.map((option, index) => (
          <button
            className={`option-button${selectedOptionId === option.id ? ' option-button--selected' : ''}`}
            type="button"
            disabled={option.disabled || !option.nextNodeId}
            key={option.id}
            onClick={() => option.nextNodeId && onAnswer(option.id, option.nextNodeId)}
          >
            <span className="option-button__index">{String(index + 1).padStart(2, '0')}</span>
            <span className="option-button__copy">
              <span>{content.answerOptions[index]}</span>
              {(option.disabled || !option.nextNodeId) && <small>Kommer senere</small>}
            </span>
            {selectedOptionId === option.id && <span className="option-button__status">Valgt</span>}
            {!option.disabled && selectedOptionId !== option.id && (
              <span className="option-button__arrow" aria-hidden="true">→</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function InstructionContent({
  content,
  node,
  status,
  onStatusChange,
}: {
  content: GuideContent
  node: InstructionNode
  status?: InstructionStatus
  onStatusChange: (status?: InstructionStatus) => void
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <GuideContentSections content={content} />

      <div className="instruction-actions" aria-label="Status for steget">
        <button className="primary-button" type="button" onClick={() => onStatusChange('completed')}>
          Ferdig
        </button>
        {content.canSkip && (
          <button className="secondary-button" type="button" onClick={() => onStatusChange('skipped')}>
            Hopp over for nå
          </button>
        )}
        {status && (
          <button className="text-button" type="button" onClick={() => onStatusChange(undefined)}>
            Marker som ikke ferdig
          </button>
        )}
      </div>
    </div>
  )
}

function GuideContentError({ kind }: { kind: 'load' | 'configuration' }) {
  return (
    <div className="guide-content-error page-enter" role="alert">
      <p className="eyebrow">Guideinnhold</p>
      <h1>{kind === 'configuration' ? 'Guiden er feil konfigurert' : 'Kunne ikke laste guiden'}</h1>
      <p>
        {kind === 'configuration'
          ? 'En publisert rad mangler eller inneholder ugyldige verdier. Kontakt den som vedlikeholder guiden.'
          : 'Google-regnearket er ikke tilgjengelig akkurat nå. Oppdater siden og prøv igjen.'}
      </p>
      <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
        Oppdater siden
      </button>
    </div>
  )
}

function CompletionContent({
  node,
  onComplete,
}: {
  node: Extract<GuideNode, { type: 'completion' }>
  onComplete: () => void
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <div className="completion-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="m17 33 10 10 21-23" />
        </svg>
      </div>
      <div className="completion-copy">
        {node.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <button className="primary-button" type="button" onClick={onComplete}>
        {node.actionLabel}
      </button>
    </div>
  )
}

export default function GuidePage() {
  const { guideId, nodeId } = useParams()
  const navigate = useNavigate()
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [contentState, setContentState] = useState<GuideContentLoadState>({ status: 'loading' })
  const guide = guideId ? guides[guideId] : undefined
  const {
    answers,
    progress,
    saveAnswer,
    saveInstructionStatus,
    resetGuideState,
  } = useGuideState(guideId ?? '')

  useEffect(() => {
    let isActive = true

    loadGuideContent()
      .then((contentById) => {
        if (isActive) setContentState({ status: 'loaded', contentById })
      })
      .catch((error: Error & { kind?: string }) => {
        if (isActive) {
          setContentState({
            status: 'error',
            kind: error.kind === 'configuration' ? 'configuration' : 'load',
          })
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  if (!guide) {
    return <Navigate to="/" replace />
  }

  if (contentState.status === 'loading') {
    return (
      <GuideLayout guide={guide}>
        <p className="guide-loading" aria-live="polite">Henter guideinnhold …</p>
      </GuideLayout>
    )
  }

  if (contentState.status === 'error') {
    return <GuideLayout guide={guide}><GuideContentError kind={contentState.kind} /></GuideLayout>
  }

  const { contentById } = contentState
  if (!validateGuideContent(guide, contentById)) {
    return <GuideLayout guide={guide}><GuideContentError kind="configuration" /></GuideLayout>
  }

  const activePath = buildActivePath(guide, answers)
  const visiblePath = buildVisiblePath(guide, answers, contentById)
  const isOverview = !nodeId || nodeId === 'overview'
  const currentGuideId = guide.id

  function nodePath(targetNodeId: string) {
    return `/guide/${currentGuideId}/${targetNodeId}`
  }

  if (isOverview) {
    const visibleNodes = visiblePath.filter((node) => node.type !== 'completion')

    return (
      <GuideLayout guide={guide}>
        <div className="overview-heading page-enter">
          <p className="eyebrow">Din aktive rute</p>
          <h1>Oversikt</h1>
          <p className="lead">Her ser du stegene som gjelder for svarene dine nå.</p>
        </div>

        <ol className="overview-list page-enter page-enter--delay">
          {visibleNodes.map((node, index) => {
            const status = node.type === 'question'
              ? getQuestionStatus(getSelectedAnswerLabel(node, answers, contentById))
              : getInstructionStatus(node.id, progress)

            return (
              <li key={node.id}>
                <button className="overview-item" type="button" onClick={() => navigate(nodePath(node.id))}>
                  <span className="overview-item__number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="overview-item__copy">
                    <strong>{getNodeTitle(node, contentById)}</strong>
                    <span className={`overview-status ${getOverviewStatusClass(status)}`}>{status}</span>
                  </span>
                  <span className="overview-item__arrow" aria-hidden="true">→</span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="overview-reset page-enter page-enter--delay">
          <button
            className="text-button overview-reset__button"
            type="button"
            onClick={() => setIsResetDialogOpen(true)}
          >
            Nullstill fremdrift
          </button>
        </div>

        {isResetDialogOpen && (
          <ResetGuideDialog
            onCancel={() => setIsResetDialogOpen(false)}
            onConfirm={() => {
              resetGuideState()
              navigate(nodePath(guide.startNodeId), { replace: true })
            }}
          />
        )}
      </GuideLayout>
    )
  }

  const node = guide.nodes[nodeId]
  const isVisible = visiblePath.some((pathNode) => pathNode.id === nodeId)

  if (!node || !isVisible) {
    const activeIndex = activePath.findIndex((pathNode) => pathNode.id === nodeId)
    const visibleIds = new Set(visiblePath.map((pathNode) => pathNode.id))
    const fallbackNode = activeIndex >= 0
      ? activePath.slice(activeIndex + 1).find((pathNode) => visibleIds.has(pathNode.id))
        ?? activePath.slice(0, activeIndex).reverse().find((pathNode) => visibleIds.has(pathNode.id))
      : visiblePath.at(-1)
    return <Navigate to={fallbackNode ? nodePath(fallbackNode.id) : '/'} replace />
  }

  const visibleNodeIndex = visiblePath.findIndex((pathNode) => pathNode.id === node.id)
  const previousNodeId = visibleNodeIndex > 0 ? visiblePath[visibleNodeIndex - 1].id : undefined
  const content = getContentForNode(node, contentById)

  function handleBack() {
    navigate(previousNodeId ? nodePath(previousNodeId) : '/')
  }

  function handleInstructionStatus(status?: InstructionStatus) {
    saveInstructionStatus(node.id, status)

    if (status && node.type === 'instruction') {
      const nextNode = visiblePath[visibleNodeIndex + 1]
      navigate(nextNode ? nodePath(nextNode.id) : '/')
    }
  }

  return (
    <GuideLayout guide={guide}>
      <GuideBackButton onClick={handleBack} />

      <div className="guide-heading page-enter">
        <p className="eyebrow">
          {node.type === 'question' ? 'Velg det som passer' : node.type === 'instruction' ? 'Guide-steg' : 'Godt jobbet'}
        </p>
        <h1>{getNodeTitle(node, contentById)}</h1>
        {node.type === 'instruction' && (
          <p className="node-status">Status: {getInstructionStatus(node.id, progress)}</p>
        )}
      </div>

      {node.type === 'question' && (
        <QuestionContent
          content={content as GuideContent}
          node={node}
          selectedOptionId={getSelectedOption(node, answers)?.id}
          onAnswer={(optionId, nextNodeId) => {
            saveAnswer(node.id, optionId)
            const nextPath = buildVisiblePath(
              guide,
              { ...answers, [node.id]: optionId },
              contentById,
            )
            const nextIndex = nextPath.findIndex((pathNode) => pathNode.id === node.id)
            const nextNode = nextPath[nextIndex + 1]
            navigate(nodePath(nextNode?.id ?? nextNodeId))
          }}
        />
      )}

      {node.type === 'instruction' && (
        <InstructionContent
          content={content as GuideContent}
          node={node}
          status={progress[node.id]}
          onStatusChange={handleInstructionStatus}
        />
      )}

      {node.type === 'completion' && (
        <CompletionContent node={node} onComplete={() => navigate(node.nextPath)} />
      )}
    </GuideLayout>
  )
}
