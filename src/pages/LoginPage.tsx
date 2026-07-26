import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { familyMembers, useAuth } from '../auth'
import AppFrame from '../components/AppFrame'

type LoginLocationState = {
  from?: string
}

export default function LoginPage() {
  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!accountId) {
      setError('Velg familiemedlem før du logger inn.')
      return
    }

    setIsSubmitting(true)
    setError('')
    const result = await login(accountId, password)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.message ?? 'Kunne ikke logge inn. Prøv igjen.')
      return
    }

    const state = location.state as LoginLocationState | null
    navigate(state?.from ?? '/', { replace: true })
  }

  return (
    <AppFrame>
      <div className="intro-block page-enter">
        <p className="eyebrow">Trygg veiviser for hytta</p>
        <h1>Velkommen til hytteguiden</h1>
        <p className="lead">Logg inn for å finne riktig fremgangsmåte, steg for steg.</p>
      </div>

      <form className="login-form page-enter page-enter--delay" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="account-id">Hvem er du?</label>
          <select
            id="account-id"
            name="accountId"
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value)
              if (error) setError('')
            }}
            aria-invalid={Boolean(error && !accountId)}
            aria-describedby={error ? 'login-error' : undefined}
            autoFocus
          >
            <option value="" disabled>Velg familie</option>
            {familyMembers.map((member) => (
              <option value={member.id} key={member.id}>{member.displayName}</option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="password">Passord</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) setError('')
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        <div className="error-space" aria-live="polite">
          {error && <p id="login-error" className="error-message">{error}</p>}
        </div>

        <button className="primary-button" type="submit" disabled={isSubmitting || status === 'loading'}>
          {isSubmitting ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>
    </AppFrame>
  )
}
