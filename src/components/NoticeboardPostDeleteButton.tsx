import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NoticeboardPost } from '../../shared/noticeboard'
import { useAuth } from '../auth'

export default function NoticeboardPostDeleteButton({ post }: { post: NoticeboardPost }) {
  const { currentUser, expireSession } = useAuth()
  const navigate = useNavigate()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (showConfirmation) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [showConfirmation])

  if (currentUser?.id !== post.ownerId) return null

  async function confirmDelete() {
    if (isDeleting) return
    setIsDeleting(true)
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/delete-noticeboard-post?id=${encodeURIComponent(post.id)}`, {
        method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (response.status === 401) return expireSession()
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: unknown } | null
        throw new Error(typeof body?.message === 'string' ? body.message : 'Kunne ikke slette innlegget. Prøv igjen.')
      }
      setShowConfirmation(false)
      navigate('/noticeboard', { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Kunne ikke slette innlegget. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <>
    <button className="danger-button" type="button" aria-haspopup="dialog" onClick={() => {
      setError('')
      setShowConfirmation(true)
    }}>Slett</button>
    {showConfirmation && <dialog ref={dialogRef} className="booking-delete-dialog noticeboard-delete-dialog"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={() => setShowConfirmation(false)}
      onCancel={(event) => { event.preventDefault(); if (!isDeleting) setShowConfirmation(false) }}
      onClick={(event) => { if (event.target === event.currentTarget && !isDeleting) setShowConfirmation(false) }}>
      <h2 id={titleId}>Er du sikker på at du vil slette?</h2>
      <p id={descriptionId}>{post.title}</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="booking-delete-dialog__actions">
        <button className="secondary-button" type="button" autoFocus disabled={isDeleting} onClick={() => setShowConfirmation(false)}>Avbryt</button>
        <button className="danger-button" type="button" disabled={isDeleting} onClick={() => void confirmDelete()}>{isDeleting ? 'Sletter …' : 'Slett'}</button>
      </div>
    </dialog>}
  </>
}
