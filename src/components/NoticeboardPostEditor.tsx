import { useState, type FormEvent } from 'react'
import type { NoticeboardPost } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import NoticeboardPostDeleteButton from './NoticeboardPostDeleteButton'

export default function NoticeboardPostEditor({ post, onUpdated }: { post: NoticeboardPost; onUpdated: (post: NoticeboardPost) => void }) {
  const { currentUser, expireSession } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(post.title)
  const [description, setDescription] = useState(post.description)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  if (currentUser?.id !== post.ownerId) return null

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const response = await fetch(`/.netlify/functions/update-noticeboard-post?id=${encodeURIComponent(post.id)}`, {
        method: 'PATCH', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      if (response.status === 401) return expireSession()
      const body = await response.json() as { post?: NoticeboardPost; message?: string }
      if (!response.ok || !body.post) throw new Error(body.message ?? 'Kunne ikke lagre innlegget. Prøv igjen.')
      onUpdated(body.post)
      setIsEditing(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Kunne ikke lagre innlegget. Prøv igjen.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing) return <div className="noticeboard-post-actions"><button className="secondary-button" type="button" onClick={() => {
    setTitle(post.title)
    setDescription(post.description)
    setError('')
    setIsEditing(true)
  }}>Rediger innlegg</button><NoticeboardPostDeleteButton post={post} /></div>

  return <form className="booking-form" onSubmit={(event) => void save(event)}>
    <div className="field-group">
      <label htmlFor="post-edit-title">Tittel</label>
      <input id="post-edit-title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} disabled={isSaving} />
    </div>
    <div className="field-group">
      <label htmlFor="post-edit-description">Tekst</label>
      <textarea id="post-edit-description" rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving} />
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="booking-form__actions">
      <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Lagrer …' : 'Lagre innlegg'}</button>
      <button className="secondary-button" type="button" disabled={isSaving} onClick={() => setIsEditing(false)}>Avbryt</button>
    </div>
  </form>
}
