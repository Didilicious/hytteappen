import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.75 19c.55-3.15 2.64-5 6.25-5s5.7 1.85 6.25 5" />
    </svg>
  )
}

export default function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  async function leaveSession() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setIsOpen(false)
    }
  }

  if (!currentUser) return null

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="account-menu__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="account-menu__icon"><PersonIcon /></span>
        <span className="account-menu__name">{currentUser.displayName}</span>
        <svg className="account-menu__chevron" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
          <path d="m2 2 4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="account-menu__popover" role="menu">
          <div className="account-menu__identity">
            <span className="account-menu__icon"><PersonIcon /></span>
            <span>
              <small>Innlogget som</small>
              <strong>{currentUser.displayName}</strong>
            </span>
          </div>
          <div className="account-menu__separator" />
          <button type="button" role="menuitem" onClick={leaveSession}>Logg ut</button>
        </div>
      )}
    </div>
  )
}
