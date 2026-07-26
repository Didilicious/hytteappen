import { Fragment, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import GuideLayout from '../components/GuideLayout'
import type { GuideNode, InstructionNode, QuestionNode } from '../guideData'
import { guides } from '../guideData'
import {
  buildActivePath,
  getInstructionStatus,
  getLogicalPreviousNodeId,
  getQuestionStatus,
  getSelectedOption,
  type InstructionStatus,
} from '../guideEngine'
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
  node,
  onAnswer,
  selectedOptionId,
}: {
  node: QuestionNode
  onAnswer: (optionId: string, nextNodeId: string) => void
  selectedOptionId?: string
}) {
  return (
    <div className="option-list page-enter page-enter--delay">
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
            <span>{option.label}</span>
            {(option.disabled || !option.nextNodeId) && <small>Kommer senere</small>}
          </span>
          {selectedOptionId === option.id && <span className="option-button__status">Valgt</span>}
          {!option.disabled && selectedOptionId !== option.id && (
            <span className="option-button__arrow" aria-hidden="true">→</span>
          )}
        </button>
      ))}
    </div>
  )
}

type KeyBoxCodeState =
  | { status: 'loading' }
  | { status: 'loaded'; code: string }
  | { status: 'error' }

function KeyBoxCodeParagraph() {
  const [codeState, setCodeState] = useState<KeyBoxCodeState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadCode() {
      try {
        const response = await fetch('/.netlify/functions/key-box-code', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })

        if (!response.ok) {
          setCodeState({ status: 'error' })
          return
        }

        const body = await response.json() as { code?: unknown }
        if (typeof body.code !== 'string' || !body.code) {
          setCodeState({ status: 'error' })
          return
        }

        setCodeState({ status: 'loaded', code: body.code })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCodeState({ status: 'error' })
        }
      }
    }

    void loadCode()

    return () => controller.abort()
  }, [])

  if (codeState.status === 'loaded') {
    return <p aria-live="polite">Koden er {codeState.code}.</p>
  }

  if (codeState.status === 'error') {
    return <p className="instruction-error" role="alert">Kunne ikke hente koden. Prøv igjen senere.</p>
  }

  return <p aria-live="polite">Henter koden …</p>
}

function InstructionContent({
  node,
  status,
  onStatusChange,
}: {
  node: InstructionNode
  status?: InstructionStatus
  onStatusChange: (status?: InstructionStatus) => void
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <div className="instruction-card">
        {node.paragraphs.map((paragraph, index) => (
          <Fragment key={paragraph}>
            <p>{paragraph}</p>
            {node.showsKeyBoxCode && index === 0 && <KeyBoxCodeParagraph />}
          </Fragment>
        ))}
      </div>

      <div className="instruction-actions" aria-label="Status for steget">
        <button className="primary-button" type="button" onClick={() => onStatusChange('completed')}>
          Ferdig
        </button>
        <button className="secondary-button" type="button" onClick={() => onStatusChange('skipped')}>
          Hopp over for nå
        </button>
        {status && (
          <button className="text-button" type="button" onClick={() => onStatusChange(undefined)}>
            Marker som ikke ferdig
          </button>
        )}
      </div>
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
  const guide = guideId ? guides[guideId] : undefined
  const {
    answers,
    progress,
    saveAnswer,
    saveInstructionStatus,
    resetGuideState,
  } = useGuideState(guideId ?? '')

  if (!guide) {
    return <Navigate to="/" replace />
  }

  const activePath = buildActivePath(guide, answers)
  const isOverview = !nodeId || nodeId === 'overview'
  const currentGuideId = guide.id

  function nodePath(targetNodeId: string) {
    return `/guide/${currentGuideId}/${targetNodeId}`
  }

  if (isOverview) {
    const visibleNodes = activePath.filter((node) => node.type !== 'completion')

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
              ? getQuestionStatus(node, answers)
              : getInstructionStatus(node.id, progress)

            return (
              <li key={node.id}>
                <button className="overview-item" type="button" onClick={() => navigate(nodePath(node.id))}>
                  <span className="overview-item__number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="overview-item__copy">
                    <strong>{node.title}</strong>
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
  const isVisible = activePath.some((pathNode) => pathNode.id === nodeId)

  if (!node || !isVisible) {
    const fallbackNode = activePath.at(-1)
    return <Navigate to={fallbackNode ? nodePath(fallbackNode.id) : '/'} replace />
  }

  const previousNodeId = getLogicalPreviousNodeId(guide, answers, node.id)

  function handleBack() {
    navigate(previousNodeId ? nodePath(previousNodeId) : '/')
  }

  function handleInstructionStatus(status?: InstructionStatus) {
    saveInstructionStatus(node.id, status)

    if (status && node.type === 'instruction') {
      navigate(nodePath(node.nextNodeId))
    }
  }

  return (
    <GuideLayout guide={guide}>
      <GuideBackButton onClick={handleBack} />

      <div className="guide-heading page-enter">
        <p className="eyebrow">
          {node.type === 'question' ? 'Velg det som passer' : node.type === 'instruction' ? 'Guide-steg' : 'Godt jobbet'}
        </p>
        <h1>{node.title}</h1>
        {node.type === 'instruction' && (
          <p className="node-status">Status: {getInstructionStatus(node.id, progress)}</p>
        )}
      </div>

      {node.type === 'question' && (
        <QuestionContent
          node={node}
          selectedOptionId={getSelectedOption(node, answers)?.id}
          onAnswer={(optionId, nextNodeId) => {
            saveAnswer(node.id, optionId)
            navigate(nodePath(nextNodeId))
          }}
        />
      )}

      {node.type === 'instruction' && (
        <InstructionContent
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
