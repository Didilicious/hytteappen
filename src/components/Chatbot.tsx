import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { GuideImage } from '../../shared/guideImages'
import { useAuth } from '../auth'
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

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: unknown }
    return typeof body.message === 'string' ? body.message : undefined
  } catch {
    return undefined
  }
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
  const { expireSession } = useAuth()
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
  }, [])

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
      const response = await fetch('/.netlify/functions/chatbot', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: nextMessages.slice(-20) }),
      })

      if (response.status === 401) {
        expireSession()
        return
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response) ?? 'Chatboten kunne ikke svare. Prøv igjen.')
      }

      const body = await response.json() as { message?: unknown; sources?: unknown }
      if (typeof body.message !== 'string' || !body.message.trim()) {
        throw new Error('Chatboten kunne ikke svare. Prøv igjen.')
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
      setError(requestError instanceof Error
        ? requestError.message
        : 'Chatboten kunne ikke svare. Prøv igjen.')
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
                Skriver …
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
        {icon !== undefined && (
          <DriveIcon driveIcon={icon} name={chatbotIconName} warningLabel="chatbot-ikonet" />
        )}
      </button>
    </div>
  )
}
