import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { getFamily } from '../../shared/families'
import { familyEventTypes } from '../../shared/familyEvents'
import { familyEventTypeLabels, type FamilyEventType } from '../familyEvents'
import { readFamilyProfiles } from '../memberProfiles'
import AppFrame from './AppFrame'
import { DatePickerField, TimePickerField } from './DateTimePickerFields'

export type FamilyEventFormValues = {
  eventType: FamilyEventType | ''
  title: string
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  location: string
  wishlistUrl: string
  moreInfo: string
}

type Props = {
  title: string
  ownerId: string
  ownerName: string
  initialValues?: FamilyEventFormValues
  submitLabel: string
  submittingLabel: string
  onSubmit: (values: FamilyEventFormValues) => Promise<string | void>
  onCancel: () => void
}

const emptyValues: FamilyEventFormValues = {
  eventType: '',
  title: '',
  startDate: '',
  endDate: null,
  startTime: '',
  endTime: '',
  location: '',
  wishlistUrl: '',
  moreInfo: '',
}

export default function FamilyEventForm({
  title,
  ownerId,
  ownerName,
  initialValues = emptyValues,
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState(initialValues)
  const [showEndDate, setShowEndDate] = useState(Boolean(initialValues.endDate))
  const [showEndTime, setShowEndTime] = useState(Boolean(initialValues.endTime))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
  const [addressStatus, setAddressStatus] = useState('')
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const locationRef = useRef<HTMLTextAreaElement>(null)
  const moreInfoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setValues(initialValues), [initialValues])

  useLayoutEffect(() => {
    for (const textarea of [locationRef.current, moreInfoRef.current]) {
      if (!textarea) continue
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [values.location, values.moreInfo])

  function setValue<Key extends keyof FamilyEventFormValues>(key: Key, value: FamilyEventFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
    setSaveError('')
  }

  async function usePrimaryAddress() {
    const primaryMember = getFamily(ownerId)?.members[0]
    if (!primaryMember) {
      setAddressStatus('Ingen adresse registrert')
      return
    }

    setIsLoadingAddress(true)
    setAddressStatus('')
    try {
      const profiles = await readFamilyProfiles(ownerId)
      const address = profiles.find(({ memberId }) => memberId === primaryMember.id)?.addresses[0]?.value.trim()
      if (!address) {
        setAddressStatus('Ingen adresse registrert')
        return
      }
      setValue('location', address)
      setAddressStatus('')
    } catch {
      setAddressStatus('Kunne ikke hente adressen. Prøv igjen.')
    } finally {
      setIsLoadingAddress(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!values.eventType) nextErrors.eventType = 'Velg type arrangement.'
    if (!values.title.trim()) nextErrors.title = 'Skriv inn en tittel.'
    if (!values.startDate) nextErrors.startDate = 'Velg dato.'
    if (values.endDate && values.startDate && values.endDate < values.startDate) {
      nextErrors.endDate = 'Sluttdato kan ikke være før dato.'
    }
    if (values.endTime && !values.startTime) nextErrors.endTime = 'Legg til tidspunkt først.'
    if (
      values.startTime
      && values.endTime
      && (!values.endDate || values.endDate === values.startDate)
      && values.endTime < values.startTime
    ) nextErrors.endTime = 'Slutt-tid kan ikke være før tidspunkt.'

    if (values.wishlistUrl) {
      try {
        const url = new URL(values.wishlistUrl)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') nextErrors.wishlistUrl = 'Skriv inn en gyldig lenke.'
      } catch {
        nextErrors.wishlistUrl = 'Skriv inn en gyldig lenke.'
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    setSaveError('')
    try {
      const errorMessage = await onSubmit({
        ...values,
        title: values.title.trim(),
        endDate: showEndDate ? values.endDate : null,
        endTime: showEndTime ? values.endTime : '',
        location: values.location.trim(),
        wishlistUrl: values.wishlistUrl.trim(),
        moreInfo: values.moreInfo.trim(),
      })
      if (errorMessage) setSaveError(errorMessage)
    } catch {
      setSaveError('Kunne ikke lagre arrangementet. Sjekk forbindelsen og prøv igjen.')
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
        <p className="booking-family">Arrangør: <strong>{ownerName}</strong></p>
      </div>

      <form className="booking-form family-event-form page-enter page-enter--delay" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="event-type">Type arrangement</label>
          <select id="event-type" required value={values.eventType} onChange={(event) => setValue('eventType', event.target.value as FamilyEventType | '')} aria-invalid={Boolean(errors.eventType)}>
            <option value="">Velg arrangement</option>
            {familyEventTypes.map((eventType) => <option key={eventType} value={eventType}>{familyEventTypeLabels[eventType]}</option>)}
          </select>
          {errors.eventType && <p className="error-message">{errors.eventType}</p>}
        </div>

        <div className="field-group">
          <label htmlFor="event-title">Tittel</label>
          <input id="event-title" type="text" maxLength={200} required value={values.title} onChange={(event) => setValue('title', event.target.value)} aria-invalid={Boolean(errors.title)} />
          {errors.title && <p className="error-message">{errors.title}</p>}
        </div>

        <div className="booking-date-grid">
          <DatePickerField
            id="event-start-date"
            label="Dato"
            required
            value={values.startDate}
            error={errors.startDate}
            onChange={(value) => setValue('startDate', value)}
          />
          {showEndDate && (
            <DatePickerField
              id="event-end-date"
              label="Sluttdato"
              min={values.startDate || undefined}
              value={values.endDate ?? ''}
              error={errors.endDate}
              onChange={(value) => setValue('endDate', value || null)}
            />
          )}
        </div>
        {!showEndDate && <button className="text-button form-add-button" type="button" onClick={() => setShowEndDate(true)}>+ Legg til sluttdato</button>}

        <div className="booking-date-grid">
          <TimePickerField
            id="event-start-time"
            label="Tidspunkt"
            value={values.startTime}
            onChange={(value) => setValue('startTime', value)}
          />
          {showEndTime && (
            <TimePickerField
              id="event-end-time"
              label="Slutt-tid"
              value={values.endTime}
              error={errors.endTime}
              onChange={(value) => setValue('endTime', value)}
            />
          )}
        </div>
        {!showEndTime && <button className="text-button form-add-button" type="button" onClick={() => setShowEndTime(true)}>+ Legg til Slutt-tid</button>}

        <div className="field-group">
          <label htmlFor="event-location">Sted</label>
          <textarea
            ref={locationRef}
            className="auto-resize-textarea auto-resize-textarea--single"
            id="event-location"
            rows={1}
            maxLength={500}
            value={values.location}
            onChange={(event) => setValue('location', event.target.value)}
          />
          <button className="secondary-button address-button" type="button" onClick={() => void usePrimaryAddress()} disabled={isLoadingAddress}>
            {isLoadingAddress ? 'Henter adresse …' : 'Bruk min adresse'}
          </button>
          {addressStatus && <p className="field-help" role="status">{addressStatus}</p>}
        </div>

        <div className="field-group">
          <label htmlFor="event-wishlist">Ønsk-lenke</label>
          <input id="event-wishlist" type="url" maxLength={2000} inputMode="url" value={values.wishlistUrl} onChange={(event) => setValue('wishlistUrl', event.target.value)} aria-invalid={Boolean(errors.wishlistUrl)} />
          {errors.wishlistUrl && <p className="error-message">{errors.wishlistUrl}</p>}
        </div>

        <div className="field-group">
          <label htmlFor="event-more-info">Mer informasjon</label>
          <textarea
            ref={moreInfoRef}
            className="auto-resize-textarea auto-resize-textarea--double"
            id="event-more-info"
            rows={2}
            maxLength={3000}
            value={values.moreInfo}
            onChange={(event) => setValue('moreInfo', event.target.value)}
          />
        </div>

        <div className="booking-form__feedback" aria-live="polite">
          {saveError && <p className="error-message" role="alert">{saveError}</p>}
        </div>
        <div className="booking-form__actions">
          <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? submittingLabel : submitLabel}</button>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isSaving}>Avbryt</button>
        </div>
      </form>
    </AppFrame>
  )
}
