import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getFamilyMember } from '../../shared/familyMembers'
import type { NoticeboardPostWithCommentCount } from '../../shared/noticeboard'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'
import NoticeboardTypeIcon from '../components/NoticeboardTypeIcon'
import ProfileImage from '../components/ProfileImage'
import { loadSolvedNoticeboardPosts } from '../noticeboard'

const solvedDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatSolvedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : solvedDateFormatter.format(date)
}

function formatCommentCount(count: number) {
  if (count === 0) return 'Ingen kommentarer'
  if (count === 1) return '1 kommentar'
  return `${count} kommentarer`
}

export default function SolvedNoticeboardPostsPage() {
  const navigate = useNavigate()
  const { expireSession } = useAuth()
  const [posts, setPosts] = useState<NoticeboardPostWithCommentCount[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const loadPosts = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      setPosts(await loadSolvedNoticeboardPosts())
      setStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke hente løste innlegg.'
      if (message.includes('Økten har utløpt')) expireSession()
      setErrorMessage(message)
      setStatus('error')
    }
  }, [expireSession])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/noticeboard')}>
        <span aria-hidden="true">←</span> Til Oppslagstavle
      </button>

      <div className="noticeboard-heading page-enter">
        <p className="eyebrow">Oppslagstavle</p>
        <h1>Løste innlegg</h1>
      </div>

      <section className="noticeboard-content page-enter page-enter--delay" aria-live="polite">
        {status === 'loading' && (
          <div className="noticeboard-skeleton" aria-label="Laster løste innlegg">
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
          <p className="noticeboard-state">Ingen løste innlegg.</p>
        )}

        {status === 'ready' && posts.length > 0 && (
          <div className="noticeboard-list">
            {posts.map((post) => {
              const owner = getFamilyMember(post.ownerId)

              return (
                <article className={`noticeboard-card noticeboard-card--${post.type === 'Info' ? 'info' : post.type === 'Spørsmål' ? 'question' : 'todo'}`} key={post.id}>
                  <div className="noticeboard-card__header">
                    <div className="noticeboard-card__type">
                      <span className="noticeboard-card__icon"><NoticeboardTypeIcon type={post.type} /></span>
                      <span>{post.type}</span>
                    </div>
                    <span className="noticeboard-card__solved-status">Løst</span>
                  </div>
                  <h2><Link to={`/noticeboard/${post.id}`}>{post.title}</Link></h2>
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
                      <span>Løst <time dateTime={post.updatedAt}>{formatSolvedDate(post.updatedAt)}</time></span>
                    </p>
                  </div>
                  <Link className="noticeboard-card__comments" to={`/noticeboard/${post.id}`}>
                    {formatCommentCount(post.commentCount)}
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </AppFrame>
  )
}
