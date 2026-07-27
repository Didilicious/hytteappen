import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { familyMembers, type FamilyMember } from '../shared/familyMembers'

export { familyMembers }
export type { FamilyMember }

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type LoginResult = {
  ok: boolean
  message?: string
}

type AuthContextValue = {
  status: AuthStatus
  currentUser: FamilyMember | null
  login: (accountId: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: unknown }
    return typeof body.message === 'string' ? body.message : undefined
  } catch {
    return undefined
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null)

  useEffect(() => {
    let isActive = true

    async function restoreSession() {
      try {
        const response = await fetch('/.netlify/functions/session', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })

        if (!isActive) return

        if (!response.ok) {
          setCurrentUser(null)
          setStatus('anonymous')
          return
        }

        const body = await response.json() as { user?: FamilyMember }
        if (!body.user?.id || !body.user.displayName) {
          setCurrentUser(null)
          setStatus('anonymous')
          return
        }

        setCurrentUser(body.user)
        setStatus('authenticated')
      } catch {
        if (isActive) {
          setCurrentUser(null)
          setStatus('anonymous')
        }
      }
    }

    void restoreSession()

    return () => {
      isActive = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    currentUser,
    async login(accountId, password) {
      try {
        const response = await fetch('/.netlify/functions/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId, password }),
        })

        if (!response.ok) {
          return {
            ok: false,
            message: await readErrorMessage(response) ?? 'Kunne ikke logge inn. Prøv igjen.',
          }
        }

        const body = await response.json() as { user?: FamilyMember }
        if (!body.user?.id || !body.user.displayName) {
          return { ok: false, message: 'Kunne ikke logge inn. Prøv igjen.' }
        }

        setCurrentUser(body.user)
        setStatus('authenticated')
        return { ok: true }
      } catch {
        return { ok: false, message: 'Kunne ikke logge inn. Prøv igjen.' }
      }
    },
    async logout() {
      const response = await fetch('/.netlify/functions/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Logout failed')
      }

      setCurrentUser(null)
      setStatus('anonymous')
    },
  }), [currentUser, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
