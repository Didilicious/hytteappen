import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import AppFrame from '../components/AppFrame'

type FormErrors = {
  fromDate?: string
  toDate?: string
}

export default function NewBookingPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [welcomeOthers, setWelcomeOthers] = useState(false)
  const [partialFamily, setPartialFamily] = useState(false)
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [showSuccess, setShowSuccess] = useState(false)
  const successTimer = useRef<number | null>(null)
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  useEffect(() => () => {
    if (successTimer.current !== null) {
      window.clearTimeout(successTimer.current)
    }
  }, [])

  function clearSuccess() {
    setShowSuccess(false)

    if (successTimer.current !== null) {
      window.clearTimeout(successTimer.current)
      successTimer.current = null
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FormErrors = {}

    if (!fromDate) {
      nextErrors.fromDate = 'Velg fra dato.'
    }

    if (!toDate) {
      nextErrors.toDate = 'Velg til dato.'
    } else if (fromDate && toDate < fromDate) {
      nextErrors.toDate = 'Til dato kan ikke være tidligere enn fra dato.'
    }

    setErrors(nextErrors)
    clearSuccess()

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setShowSuccess(true)
    successTimer.current = window.setTimeout(() => {
      setShowSuccess(false)
      successTimer.current = null
    }, 5000)
  }

  return (
    <AppFrame showAccount>
      <div className="booking-form-heading page-enter">
        <p className="eyebrow">Hyttekalender</p>
        <h1>Registrer ny tid</h1>
        <p className="booking-family">
          Registreres for: <strong>{currentUser?.displayName}</strong>
        </p>
      </div>

      <form className="booking-form page-enter page-enter--delay" onSubmit={handleSubmit} noValidate>
        <div className="booking-date-grid">
          <div className="field-group">
            <label htmlFor="from-date">Fra dato</label>
            <input
              id="from-date"
              name="fromDate"
              type="date"
              required
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setErrors((current) => ({ ...current, fromDate: undefined, toDate: undefined }))
                clearSuccess()
              }}
              aria-invalid={Boolean(errors.fromDate)}
              aria-describedby={errors.fromDate ? 'from-date-error date-help' : 'date-help'}
              autoFocus
            />
            {errors.fromDate && <p id="from-date-error" className="error-message">{errors.fromDate}</p>}
          </div>

          <div className="field-group">
            <label htmlFor="to-date">Til dato</label>
            <input
              id="to-date"
              name="toDate"
              type="date"
              required
              min={fromDate || undefined}
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setErrors((current) => ({ ...current, toDate: undefined }))
                clearSuccess()
              }}
              aria-invalid={Boolean(errors.toDate)}
              aria-describedby={errors.toDate ? 'to-date-error date-help' : 'date-help'}
            />
            {errors.toDate && <p id="to-date-error" className="error-message">{errors.toDate}</p>}
          </div>
        </div>

        <p id="date-help" className="field-help">Begge datoene er inkludert.</p>

        <div className="booking-checkboxes">
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="welcomeOthers"
              checked={welcomeOthers}
              onChange={(event) => {
                setWelcomeOthers(event.target.checked)
                clearSuccess()
              }}
            />
            <span>Vi ønsker gjerne flere med oss!</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="partialFamily"
              checked={partialFamily}
              onChange={(event) => {
                setPartialFamily(event.target.checked)
                clearSuccess()
              }}
            />
            <span>Ikke hele familien drar</span>
          </label>
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="booking-comment">Kommentar</label>
            <span aria-live="polite">{comment.length} / 1000</span>
          </div>
          <textarea
            id="booking-comment"
            name="comment"
            maxLength={1000}
            rows={6}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value)
              clearSuccess()
            }}
          />
        </div>

        <div className="booking-form__feedback" aria-live="polite">
          {showSuccess && (
            <p className="success-message" role="status">
              Skjemaet er validert. Ingen opplysninger er lagret ennå.
            </p>
          )}
        </div>

        <div className="booking-form__actions">
          <button className="primary-button" type="submit">Lagre</button>
          <button className="secondary-button" type="button" onClick={() => navigate('/booking')}>
            Avbryt
          </button>
        </div>
      </form>
    </AppFrame>
  )
}
