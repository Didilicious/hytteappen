import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { noticeboardPostTypes, type NoticeboardPostType } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import { createNoticeboardPost } from '../noticeboard'

export default function NewNoticeboardPostPage() {
  const navigate = useNavigate()
  const { expireSession } = useAuth()
  const [type, setType] = useState<NoticeboardPostType>('Info')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setTitleError('Skriv inn en tittel.')
      return
    }

    setIsSaving(true)
    setSaveError('')

    try {
      await createNoticeboardPost({ type, title: trimmedTitle, description: description.trim() })
      navigate('/noticeboard', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke lagre innlegget.'
      if (message.includes('Økten har utløpt')) expireSession()
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppFrame showAccount>
      <div className="noticeboard-form-heading page-enter">
        <h1>Nytt innlegg</h1>
      </div>

      <form className="noticeboard-form page-enter page-enter--delay" onSubmit={(event) => void submitPost(event)}>
        <div className="field-group">
          <label htmlFor="noticeboard-type">Type</label>
          <select id="noticeboard-type" value={type} onChange={(event) => setType(event.target.value as NoticeboardPostType)} required>
            {noticeboardPostTypes.map((postType) => <option key={postType} value={postType}>{postType}</option>)}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="noticeboard-title">Tittel</label>
          <input
            id="noticeboard-title"
            type="text"
            maxLength={160}
            value={title}
            required
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? 'noticeboard-title-error' : undefined}
            onChange={(event) => {
              setTitle(event.target.value)
              setTitleError('')
              setSaveError('')
            }}
          />
          {titleError && <p id="noticeboard-title-error" className="error-message">{titleError}</p>}
        </div>

        <div className="field-group">
          <label htmlFor="noticeboard-description">Mer informasjon</label>
          <textarea
            id="noticeboard-description"
            rows={5}
            maxLength={2000}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
              setSaveError('')
            }}
          />
        </div>

        <div className="noticeboard-form__feedback" aria-live="polite">
          {saveError && <p className="error-message" role="alert">{saveError}</p>}
        </div>

        <div className="noticeboard-form__actions">
          <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Lagrer …' : 'Lagre'}</button>
          <button className="secondary-button" type="button" disabled={isSaving} onClick={() => navigate('/noticeboard')}>Avbryt</button>
        </div>
      </form>
    </AppFrame>
  )
}
