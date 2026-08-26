import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getFamilyMember } from '../../shared/familyMembers'
import type { NoticeboardComment, NoticeboardPost } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import NoticeboardTypeIcon from '../components/NoticeboardTypeIcon'
import ProfileImage from '../components/ProfileImage'
import {
  createNoticeboardComment,
  loadNoticeboardComments,
  loadNoticeboardPost,
} from '../noticeboard'

const detailDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : detailDateFormatter.format(date)
}

function sortComments(comments: NoticeboardComment[]) {
  return [...comments].sort((first, second) => (
    first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id)
  ))
}

export default function NoticeboardPostPage() {
  const navigate = useNavigate()
  const { postId = '' } = useParams()
  const { expireSession } = useAuth()
  const [post, setPost] = useState<NoticeboardPost | null>(null)
  const [postStatus, setPostStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [postError, setPostError] = useState('')
  const [comments, setComments] = useState<NoticeboardComment[]>([])
  const [commentsStatus, setCommentsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [commentsError, setCommentsError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleSessionError = useCallback((message: string) => {
    if (message.includes('Økten har utløpt')) expireSession()
  }, [expireSession])

  const loadPost = useCallback(async () => {
    setPostStatus('loading')
    setPostError('')
    setCommentsStatus('loading')
    setCommentsError('')

    try {
      const detail = await loadNoticeboardPost(postId)
      setPost(detail.post)
      setPostStatus('ready')
      if (detail.comments) {
        setComments(sortComments(detail.comments))
        setCommentsStatus('ready')
      } else {
        setCommentsError('Kunne ikke hente kommentarene.')
        setCommentsStatus('error')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke hente innlegget.'
      handleSessionError(message)
      setPostError(message)
      setPostStatus('error')
    }
  }, [handleSessionError, postId])

  const loadComments = useCallback(async () => {
    setCommentsStatus('loading')
    setCommentsError('')

    try {
      setComments(sortComments(await loadNoticeboardComments(postId)))
      setCommentsStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke hente kommentarene.'
      handleSessionError(message)
      setCommentsError(message)
      setCommentsStatus('error')
    }
  }, [handleSessionError, postId])

  useEffect(() => {
    void loadPost()
  }, [loadPost])

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedText = commentText.trim()
    if (!trimmedText) {
      setSubmitError('Skriv en kommentar før du sender.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const comment = await createNoticeboardComment(postId, trimmedText, idempotencyKey)
      setComments((currentComments) => sortComments([
        ...currentComments.filter((currentComment) => currentComment.id !== comment.id),
        comment,
      ]))
      setCommentsStatus('ready')
      setCommentsError('')
      setCommentText('')
      setIdempotencyKey(crypto.randomUUID())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke lagre kommentaren. Prøv igjen.'
      handleSessionError(message)
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/noticeboard')}>
        <span aria-hidden="true">←</span> Til Oppslagstavle
      </button>

      {postStatus === 'loading' && <div className="noticeboard-skeleton"><span /></div>}

      {postStatus === 'error' && (
        <div className="noticeboard-state noticeboard-state--error">
          <p>{postError}</p>
          <button className="secondary-button" type="button" onClick={() => void loadPost()}>Prøv igjen</button>
        </div>
      )}

      {postStatus === 'ready' && post && (
        <>
          <article className={`noticeboard-detail noticeboard-card--${post.type === 'Info' ? 'info' : post.type === 'Spørsmål' ? 'question' : 'todo'}`}>
            <div className="noticeboard-card__type">
              <span className="noticeboard-card__icon"><NoticeboardTypeIcon type={post.type} /></span>
              <span>{post.type}</span>
            </div>
            <h1>{post.title}</h1>
            {post.description && <p className="noticeboard-detail__description">{post.description}</p>}
            <dl className="noticeboard-detail__meta">
              <div>
                <dt>Opprettet av</dt>
                <dd className="noticeboard-detail__author">
                  {getFamilyMember(post.ownerId) && (
                    <ProfileImage
                      familyId={post.ownerId}
                      variant="family"
                      alt=""
                      className="noticeboard-family-avatar"
                    />
                  )}
                  <span>{getFamilyMember(post.ownerId)?.displayName ?? 'Ukjent familie'}</span>
                </dd>
              </div>
              <div><dt>Opprettet</dt><dd><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></dd></div>
              <div><dt>Status</dt><dd>{post.status === 'open' ? 'Åpen' : 'Løst'}</dd></div>
            </dl>
          </article>

          <section className="noticeboard-comments" aria-labelledby="comments-heading">
            <h2 id="comments-heading">Kommentarer</h2>

            {commentsStatus === 'loading' && <p className="noticeboard-comments__state">Laster kommentarer …</p>}
            {commentsStatus === 'error' && (
              <div className="noticeboard-comments__error">
                <p>{commentsError}</p>
                <button className="secondary-button" type="button" onClick={() => void loadComments()}>Prøv igjen</button>
              </div>
            )}
            {commentsStatus === 'ready' && comments.length === 0 && (
              <p className="noticeboard-comments__state">Ingen kommentarer ennå.</p>
            )}
            {comments.length > 0 && (
              <ol className="noticeboard-comment-list">
                {comments.map((comment) => {
                  const owner = getFamilyMember(comment.ownerId)

                  return (
                    <li className="noticeboard-comment" key={comment.id}>
                      {owner && (
                        <ProfileImage
                          familyId={owner.id}
                          variant="family"
                          alt=""
                          className="noticeboard-family-avatar noticeboard-comment__avatar"
                        />
                      )}
                      <div className="noticeboard-comment__body">
                        <div className="noticeboard-comment__meta">
                          <strong>{owner?.displayName ?? 'Ukjent familie'}</strong>
                          <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                        </div>
                        <p>{comment.text}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <form className="noticeboard-comment-form" onSubmit={(event) => void submitComment(event)}>
              <div className="field-group">
                <label htmlFor="noticeboard-comment">Skriv en kommentar</label>
                <textarea
                  id="noticeboard-comment"
                  value={commentText}
                  aria-invalid={Boolean(submitError)}
                  onChange={(event) => {
                    setCommentText(event.target.value)
                    if (submitError) setSubmitError('')
                  }}
                />
              </div>
              <div className="noticeboard-comment-form__feedback" aria-live="polite">
                {submitError && <p className="error-message">{submitError}</p>}
              </div>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sender …' : 'Send'}
              </button>
            </form>
          </section>
        </>
      )}
    </AppFrame>
  )
}
