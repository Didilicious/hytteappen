import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import { useAuth } from '../auth'
import { useOnline } from '../offlineGuides'
import { answerFromDownloadedGuides, ChatbotError } from '../offlineChatbot'
import { loadHomeIcons } from '../guideImages'
import DriveIcon, { warnAboutMissingDriveIcons } from './DriveIcon'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

type ChatSource = {
  label: string
  path: string
}

const chatbotIconName = 'icon_chatbot'
const welcomeMessage: ChatMessage = {
  role: 'assistant',
  content: 'Hei! Hva kan jeg hjelpe deg med?',
}

function readSources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) return []

  return value.filter((source): source is ChatSource => {
    if (!source || typeof source !== 'object') return false
    const { label, path } = source as Partial<ChatSource>
    return typeof label === 'string' && Boolean(label.trim())
      && typeof path === 'string' && path.startsWith('/')
  }).slice(0, 3)
}

export default function Chatbot() {
  const { expireSession, status } = useAuth()
  const online = useOnline()
  const localOnly = !online || status === 'anonymous'
  const [usingLocalSearch, setUsingLocalSearch] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [icon, setIcon] = useState<GuideImage | null>()
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const messageAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let isActive = true
    if (localOnly) {
      setIcon(null)
      return
    }

    loadHomeIcons([chatbotIconName])
      .then((iconsByName) => {
        if (isActive) setIcon(iconsByName[chatbotIconName] ?? null)
      })
      .catch(() => {
        if (isActive) {
          setIcon(null)
          warnAboutMissingDriveIcons('chatbot-ikonet')
        }
      })

    return () => {
      isActive = false
    }
  }, [localOnly])

  useEffect(() => {
    if (!isOpen) return

    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight
    }
  }, [isOpen, isSubmitting, messages])

  useEffect(() => {
    if (!isOpen) return

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80)
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const content = input.trim()
    if (!content || submittingRef.current) return

    submittingRef.current = true
    const userMessage: ChatMessage = { role: 'user', content }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setIsSubmitting(true)

    try {
      const replyLocally = async () => {
        setUsingLocalSearch(true)
        const answer = await answerFromDownloadedGuides(content)
        setMessages((current) => [...current, { role: 'assistant', ...answer }])
      }
      if (localOnly || navigator.onLine === false) {
        await replyLocally()
        return
      }
      setUsingLocalSearch(false)
      let response: Response
      try {
        response = await fetch('/.netlify/functions/chatbot', {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages.slice(-20) }),
          signal: AbortSignal.timeout(30_000),
        })
      } catch {
        await replyLocally()
        return
      }

      if (response.status === 401) {
        expireSession()
        return
      }

      if (!response.ok) {
        throw new ChatbotError(response.status === 429
          ? 'Chatboten har fått for mange spørsmål på kort tid. Vent litt og prøv igjen.'
          : 'Chatboten er ikke tilgjengelig akkurat nå. Prøv igjen om litt. Du kan også åpne guidene under Offline-innhold.')
      }

      const body = await response.json() as { message?: unknown; sources?: unknown }
      if (typeof body.message !== 'string' || !body.message.trim()) {
        throw new ChatbotError('Chatboten sendte et tomt eller ugyldig svar. Prøv å sende spørsmålet på nytt.')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: body.message as string,
          sources: readSources(body.sources),
        },
      ])
    } catch (requestError) {
      setMessages((currentMessages) => currentMessages.slice(0, -1))
      setInput(content)
      setError(requestError instanceof ChatbotError
        ? requestError.message
        : 'Svaret fra chatboten kunne ikke leses. Prøv å sende spørsmålet på nytt.')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void sendMessage()
  }

  return (
    <div className="chatbot">
      {isOpen && (
        <section className="chatbot-panel" role="dialog" aria-labelledby="chatbot-title">
          <header className="chatbot-header">
            <div>
              <p className="eyebrow">Familieassistent</p>
              <h2 id="chatbot-title">Hyttehjelperen</h2>
            </div>
            <button
              className="chatbot-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Minimer chatboten"
            >
              <span aria-hidden="true">−</span>
            </button>
          </header>

          {(localOnly || usingLocalSearch) && <p className="chatbot-offline-status" role="status">
            {!online ? 'Du er offline.' : 'Søker lokalt fordi nettjenesten ikke er tilgjengelig.'} Jeg søker bare i guidene som er lastet ned på denne enheten.
            {' '}<Link to="/offline-innhold" onClick={() => setIsOpen(false)}>Offline-innhold</Link>
          </p>}
          <div className="chatbot-messages" ref={messageAreaRef} role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`chatbot-message-group chatbot-message-group--${message.role}`} key={`${message.role}-${index}`}>
                <div className={`chatbot-message chatbot-message--${message.role}`}>
                  {message.content}
                </div>
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <nav className="chatbot-sources" aria-label="Kilder i Hytteappen">
                    {message.sources.map((source) => (
                      <Link to={source.path} onClick={() => setIsOpen(false)} key={source.path}>
                        <span>Kilde: {source.label}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            ))}
            {isSubmitting && (
              <div className="chatbot-message chatbot-message--assistant chatbot-message--loading">
                {localOnly || usingLocalSearch ? 'Søker i nedlastede guider …' : 'Skriver …'}
              </div>
            )}
          </div>

          <form className="chatbot-form" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chatbot-input">Skriv en melding</label>
            <textarea
              id="chatbot-input"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Spør om noe …"
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting || !input.trim()}>
              Send
            </button>
          </form>
          {error && <p className="chatbot-error" role="alert">{error}</p>}
        </section>
      )}

      <button
        className="chatbot-trigger"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Minimer chatboten' : 'Åpne chatboten'}
        aria-expanded={isOpen}
      >
        {localOnly ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z" />
            <path d="M7 10h10M7 14h6" />
          </svg>
        ) : icon !== undefined && (
          <DriveIcon driveIcon={icon} name={chatbotIconName} warningLabel="chatbot-ikonet" />
        )}
      </button>
    </div>
  )
}
