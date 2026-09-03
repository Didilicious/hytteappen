import { useState, type FormEvent } from 'react'
import AppFrame from './AppFrame'

export type BookingFormValues = {
  fromDate: string
  toDate: string
  welcomesOthers: boolean
  partialFamily: boolean
  comment: string
}

type FormErrors = {
  fromDate?: string
  toDate?: string
}

type BookingFormProps = {
  title: string
  ownerName: string
  initialValues?: BookingFormValues
  submitLabel: string
  submittingLabel: string
  onSubmit: (values: BookingFormValues) => Promise<string | undefined>
  onCancel: () => void
}

const emptyValues: BookingFormValues = {
  fromDate: '',
  toDate: '',
  welcomesOthers: false,
  partialFamily: false,
  comment: '',
}

export default function BookingForm({
  title,
  ownerName,
  initialValues = emptyValues,
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
}: BookingFormProps) {
  const [fromDate, setFromDate] = useState(initialValues.fromDate)
  const [toDate, setToDate] = useState(initialValues.toDate)
  const [welcomesOthers, setWelcomesOthers] = useState(initialValues.welcomesOthers)
  const [partialFamily, setPartialFamily] = useState(initialValues.partialFamily)
  const [comment, setComment] = useState(initialValues.comment)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function clearSaveError() {
    setSaveError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!fromDate) nextErrors.fromDate = 'Velg fra dato.'
    if (!toDate) {
      nextErrors.toDate = 'Velg til dato.'
    } else if (fromDate && toDate < fromDate) {
      nextErrors.toDate = 'Til dato kan ikke være tidligere enn fra dato.'
    }

    setErrors(nextErrors)
    clearSaveError()
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    try {
      const errorMessage = await onSubmit({
        fromDate,
        toDate,
        welcomesOthers,
        partialFamily,
        comment: comment.trim(),
      })
      if (errorMessage) setSaveError(errorMessage)
    } catch {
      setSaveError('Kunne ikke lagre tiden. Sjekk forbindelsen og prøv igjen.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={onCancel} disabled={isSaving}>
        <span aria-hidden="true">←</span>
        Tilbake
      </button>
      <div className="booking-form-heading page-enter">
        <p className="eyebrow">Familiekalender</p>
        <h1>{title}</h1>
        <p className="booking-family">
          Registreres for: <strong>{ownerName}</strong>
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
                clearSaveError()
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
                clearSaveError()
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
              checked={welcomesOthers}
              onChange={(event) => {
                setWelcomesOthers(event.target.checked)
                clearSaveError()
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
                clearSaveError()
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
              clearSaveError()
            }}
          />
        </div>

        <div className="booking-form__feedback" aria-live="polite">
          {saveError && <p className="error-message" role="alert">{saveError}</p>}
        </div>

        <div className="booking-form__actions">
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? submittingLabel : submitLabel}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isSaving}>
            Avbryt
          </button>
        </div>
      </form>
    </AppFrame>
  )
}
