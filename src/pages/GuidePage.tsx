import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GuideContent } from '../../shared/guideContent'
import GuideContentSections from '../components/GuideContentSections'
import GuideLayout from '../components/GuideLayout'
import { guides } from '../guideData'
import { loadGuideContent, type GuideContentLoadState } from '../guideContent'
import {
  buildVisiblePages,
  getInstructionStatus,
  getQuestionStatus,
  orderGuidePages,
  type InstructionStatus,
} from '../guideEngine'
import { loadGuideImages, type GuideImagesLoadState } from '../guideImages'
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

function ResetGuideDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
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
  imageState,
  onAnswer,
  selectedAnswer,
}: {
  content: GuideContent
  imageState: GuideImagesLoadState
  onAnswer: (answer: string) => void
  selectedAnswer?: string
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <GuideContentSections content={content} imageState={imageState} />
      <div className="option-list">
        {content.answerOptions.map((answer, index) => (
          <button
            className={`option-button${selectedAnswer === answer ? ' option-button--selected' : ''}`}
            type="button"
            key={`${index}-${answer}`}
            onClick={() => onAnswer(answer)}
          >
            <span className="option-button__index">{String(index + 1).padStart(2, '0')}</span>
            <span className="option-button__copy"><span>{answer}</span></span>
            {selectedAnswer === answer && <span className="option-button__status">Valgt</span>}
            {selectedAnswer !== answer && <span className="option-button__arrow" aria-hidden="true">→</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function InstructionContent({
  content,
  imageState,
  status,
  onStatusChange,
}: {
  content: GuideContent
  imageState: GuideImagesLoadState
  status?: InstructionStatus
  onStatusChange: (status?: InstructionStatus) => void
}) {
  return (
    <div className="guide-body page-enter page-enter--delay">
      <GuideContentSections content={content} imageState={imageState} />
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
          ? 'Regnearket mangler nødvendige kolonner eller inneholder ugyldige verdier.'
          : 'Google-regnearket er ikke tilgjengelig akkurat nå. Oppdater siden og prøv igjen.'}
      </p>
      <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
        Oppdater siden
      </button>
    </div>
  )
}

export default function GuidePage() {
  const { guideId, nodeId } = useParams()
  const navigate = useNavigate()
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [contentState, setContentState] = useState<GuideContentLoadState>({ status: 'loading' })
  const [imageState, setImageState] = useState<GuideImagesLoadState>({ status: 'loading' })
  const guide = guideId ? guides[guideId] : undefined
  const { answers, progress, saveAnswer, saveInstructionStatus, resetGuideState } = useGuideState(guideId ?? '')

  useEffect(() => {
    let isActive = true
    loadGuideContent()
      .then((content) => {
        if (!isActive) return
        setContentState({ status: 'loaded', content })
        loadGuideImages(content)
          .then((imagesByGroup) => {
            if (isActive) setImageState({ status: 'loaded', imagesByGroup })
          })
          .catch(() => {
            if (isActive) setImageState({ status: 'error' })
          })
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

  if (!guide) return <Navigate to="/" replace />

  if (contentState.status === 'loading') {
    return <GuideLayout guide={guide}><p className="guide-loading" aria-live="polite">Henter guideinnhold …</p></GuideLayout>
  }

  if (contentState.status === 'error') {
    return <GuideLayout guide={guide}><GuideContentError kind={contentState.kind} /></GuideLayout>
  }

  const { content } = contentState
  const orderedPages = orderGuidePages(guide, content)
  const visiblePages = buildVisiblePages(guide, content, answers, progress)
  const nodePath = (targetNodeId: string) => `/guide/${guide.id}/${targetNodeId}`

  if (!nodeId) {
    return <Navigate to={visiblePages[0] ? nodePath(visiblePages[0].id) : nodePath('overview')} replace />
  }

  if (nodeId === 'overview') {
    return (
      <GuideLayout guide={guide}>
        <div className="overview-heading page-enter">
          <p className="eyebrow">Din aktive rute</p>
          <h1>Oversikt</h1>
          <p className="lead">Her ser du stegene som gjelder for svarene dine nå.</p>
        </div>

        {visiblePages.length > 0 ? (
          <ol className="overview-list page-enter page-enter--delay">
            {visiblePages.map((page, index) => {
              const status = page.type === 'question'
                ? getQuestionStatus(answers[page.id])
                : getInstructionStatus(page.id, progress)
              return (
                <li key={page.id}>
                  <button className="overview-item" type="button" onClick={() => navigate(nodePath(page.id))}>
                    <span className="overview-item__number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="overview-item__copy">
                      <strong>{page.title}</strong>
                      <span className={`overview-status ${getOverviewStatusClass(status)}`}>{status}</span>
                    </span>
                    <span className="overview-item__arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="guide-content-error page-enter page-enter--delay">
            <p>Ingen publiserte sider er tilgjengelige for denne guiden ennå.</p>
          </div>
        )}

        <div className="overview-reset page-enter page-enter--delay">
          <button className="text-button overview-reset__button" type="button" onClick={() => setIsResetDialogOpen(true)}>
            Nullstill fremdrift
          </button>
        </div>

        {isResetDialogOpen && (
          <ResetGuideDialog
            onCancel={() => setIsResetDialogOpen(false)}
            onConfirm={() => {
              resetGuideState()
              navigate(`/guide/${guide.id}`, { replace: true })
            }}
          />
        )}
      </GuideLayout>
    )
  }

  const page = orderedPages.find((candidate) => candidate.id === nodeId)
  const visibleIndex = visiblePages.findIndex((candidate) => candidate.id === nodeId)

  if (!page || visibleIndex < 0) {
    const orderedIndex = orderedPages.findIndex((candidate) => candidate.id === nodeId)
    const visibleIds = new Set(visiblePages.map((candidate) => candidate.id))
    const fallback = orderedIndex >= 0
      ? orderedPages.slice(orderedIndex + 1).find((candidate) => visibleIds.has(candidate.id))
        ?? orderedPages.slice(0, orderedIndex).reverse().find((candidate) => visibleIds.has(candidate.id))
      : visiblePages[0]
    return <Navigate to={fallback ? nodePath(fallback.id) : nodePath('overview')} replace />
  }

  const currentPage = page
  const previousPage = visiblePages[visibleIndex - 1]
  const navigateAfter = (
    currentPage: GuideContent,
    nextAnswers = answers,
    nextProgress = progress,
  ) => {
    const nextVisiblePages = buildVisiblePages(guide, content, nextAnswers, nextProgress)
    const currentOrder = orderedPages.findIndex((candidate) => candidate.id === currentPage.id)
    const nextPage = nextVisiblePages.find((candidate) => (
      orderedPages.findIndex((orderedPage) => orderedPage.id === candidate.id) > currentOrder
    ))
    navigate(nextPage ? nodePath(nextPage.id) : nodePath('overview'))
  }

  function handleInstructionStatus(status?: InstructionStatus) {
    saveInstructionStatus(currentPage.id, status)
    if (status) {
      navigateAfter(currentPage, answers, { ...progress, [currentPage.id]: status })
    }
  }

  return (
    <GuideLayout guide={guide}>
      <GuideBackButton onClick={() => navigate(previousPage ? nodePath(previousPage.id) : '/')} />
      <div className="guide-heading page-enter">
        <p className="eyebrow">{currentPage.type === 'question' ? 'Velg det som passer' : 'Guide-steg'}</p>
        <h1>{currentPage.title}</h1>
        {currentPage.type === 'step' && (
          <p className="node-status">Status: {getInstructionStatus(currentPage.id, progress)}</p>
        )}
      </div>

      {currentPage.type === 'question' ? (
        <QuestionContent
          content={currentPage}
          imageState={imageState}
          selectedAnswer={currentPage.answerOptions.includes(answers[currentPage.id]) ? answers[currentPage.id] : undefined}
          onAnswer={(answer) => {
            saveAnswer(currentPage.id, answer)
            navigateAfter(currentPage, { ...answers, [currentPage.id]: answer })
          }}
        />
      ) : (
        <InstructionContent
          content={currentPage}
          imageState={imageState}
          status={progress[currentPage.id]}
          onStatusChange={handleInstructionStatus}
        />
      )}
    </GuideLayout>
  )
}
