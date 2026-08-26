import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getFamilyMember } from '../../shared/familyMembers'
import type { NoticeboardPost, NoticeboardPostSummary } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import NoticeboardTypeIcon from '../components/NoticeboardTypeIcon'
import ProfileImage from '../components/ProfileImage'
import { loadOpenNoticeboardPosts, markNoticeboardPostSolved } from '../noticeboard'

const noticeboardDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatCreationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : noticeboardDateFormatter.format(date)
}

export default function NoticeboardPage() {
  const navigate = useNavigate()
  const { currentUser, expireSession } = useAuth()
  const [posts, setPosts] = useState<NoticeboardPostSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [solvingPostId, setSolvingPostId] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      setPosts(await loadOpenNoticeboardPosts())
      setStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke hente innleggene.'
      if (message.includes('Økten har utløpt')) expireSession()
      setErrorMessage(message)
      setStatus('error')
    }
  }, [expireSession])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  async function solvePost(post: NoticeboardPost) {
    if (!window.confirm(`Markere «${post.title}» som løst?`)) return

    setSolvingPostId(post.id)
    setErrorMessage('')

    try {
      await markNoticeboardPostSolved(post.id)
      setPosts((currentPosts) => currentPosts.filter((currentPost) => currentPost.id !== post.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke markere innlegget som løst.'
      if (message.includes('Økten har utløpt')) expireSession()
      setErrorMessage(message)
    } finally {
      setSolvingPostId(null)
    }
  }

  return (
    <AppFrame showAccount>
      <div className="noticeboard-heading page-enter">
        <h1>Oppslagstavle</h1>
        <button className="primary-button noticeboard-new-button" type="button" onClick={() => navigate('/noticeboard/new')}>
          + Nytt innlegg
        </button>
      </div>

      <section className="noticeboard-content page-enter page-enter--delay" aria-live="polite">
        {status === 'loading' && (
          <div className="noticeboard-skeleton" aria-label="Laster innlegg">
            <span />
            <span />
          </div>
        )}

        {status === 'error' && (
          <div className="noticeboard-state noticeboard-state--error">
            <p>{errorMessage}</p>
            <button className="secondary-button" type="button" onClick={() => void loadPosts()}>Prøv igjen</button>
          </div>
        )}

        {status === 'ready' && posts.length === 0 && (
          <p className="noticeboard-state">Ingen åpne innlegg.</p>
        )}

        {status === 'ready' && posts.length > 0 && (
          <div className="noticeboard-list">
            {posts.map((post) => {
              const owner = getFamilyMember(post.ownerId)
              const isOwner = post.ownerId === currentUser?.id

              return (
                <article className={`noticeboard-card noticeboard-card--${post.type === 'Info' ? 'info' : post.type === 'Spørsmål' ? 'question' : 'todo'}`} key={post.id}>
                  <div className="noticeboard-card__header">
                    <div className="noticeboard-card__type">
                      <span className="noticeboard-card__icon"><NoticeboardTypeIcon type={post.type} /></span>
                      <span>{post.type}</span>
                    </div>
                    <span className="noticeboard-card__unread-slot">
                      {post.unread && (
                        <span className="noticeboard-card__unread-dot">
                          <span className="visually-hidden">Ulest aktivitet</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <h2><Link to={`/noticeboard/${post.id}`}>{post.title}</Link></h2>
                  {post.description && <p className="noticeboard-card__description">{post.description}</p>}
                  <div className="noticeboard-card__author">
                    {owner && (
                      <ProfileImage
                        familyId={owner.id}
                        variant="family"
                        alt=""
                        className="noticeboard-family-avatar"
                      />
                    )}
                    <p className="noticeboard-card__meta">
                      <span>{owner?.displayName ?? 'Ukjent familie'}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={post.createdAt}>{formatCreationDate(post.createdAt)}</time>
                    </p>
                  </div>
                  <Link className="noticeboard-card__comments" to={`/noticeboard/${post.id}`}>
                    {post.commentCount === 0
                      ? 'Ingen kommentarer'
                      : post.commentCount === 1
                        ? '1 kommentar'
                        : `${post.commentCount} kommentarer`}
                  </Link>
                  {isOwner && (
                    <button
                      className="noticeboard-solve-button"
                      type="button"
                      disabled={solvingPostId === post.id}
                      onClick={() => void solvePost(post)}
                    >
                      {solvingPostId === post.id ? 'Markerer …' : 'Marker som løst'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {status !== 'error' && errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
      </section>

      <Link className="secondary-button noticeboard-solved-link" to="/noticeboard/solved">
        Vis løste innlegg
      </Link>
    </AppFrame>
  )
}
