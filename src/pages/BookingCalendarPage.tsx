import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { familyMembers } from '../../shared/familyMembers'
import {
  getBirthdayDescription,
  getBirthdayIndicatorLabel,
  getBirthdaysForDate,
  type BirthdayMember,
} from '../birthdays'
import { normalizeBooking, resolveBookingOwner, type Booking } from '../bookings'
import {
  addMonths,
  formatDateKey,
  getBookingsForDate,
  getCalendarDays,
  hasBookingsInMonth,
  norwegianWeekdays,
  startOfMonth,
} from '../calendar'
import AppFrame from '../components/AppFrame'
import ProfileImage from '../components/ProfileImage'
import {
  calendarReturnStorageKey,
  getBookingDetailsPath,
  getCalendarPath,
  parseCalendarMonth,
  type CalendarReturnState,
} from '../calendarNavigation'

const monthFormatter = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function MonthButton({ direction, onClick }: { direction: 'previous' | 'next'; onClick: () => void }) {
  const isPrevious = direction === 'previous'
  return (
    <button
      className="calendar-icon-button"
      type="button"
      onClick={onClick}
      aria-label={isPrevious ? 'Forrige måned' : 'Neste måned'}
    >
      <span aria-hidden="true">{isPrevious ? '←' : '→'}</span>
    </button>
  )
}

function CalendarLoading() {
  return (
    <div className="calendar-loading" role="status" aria-live="polite">
      <span className="calendar-loading__title">Henter registrerte tider …</span>
      <div className="calendar-skeleton" aria-hidden="true">
        {Array.from({ length: 35 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  )
}

function BirthdayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 10.5h14v9H5zM4 8h16v3H4zM12 8v11M7.5 8c-1.7 0-2.5-.8-2.5-2 0-1.1.8-2 2-2 2.1 0 3.5 2.5 4.5 4M16.5 8c1.7 0 2.5-.8 2.5-2 0-1.1-.8-2-2-2-2.1 0-3.5 2.5-4.5 4" />
    </svg>
  )
}

type BirthdayDialogState = {
  birthdays: readonly BirthdayMember[]
  trigger: HTMLButtonElement
}

export default function BookingCalendarPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateKey(today)
  const currentMonth = startOfMonth(today)
  const [selectedMonth, setSelectedMonth] = useState(() => parseCalendarMonth(location.search, today))
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [birthdayDialog, setBirthdayDialog] = useState<BirthdayDialogState | null>(null)
  const pendingScrollPosition = useRef<{ x: number; y: number } | null>(null)
  const birthdayCloseButtonRef = useRef<HTMLButtonElement>(null)

  const closeBirthdayDialog = useCallback(() => {
    setBirthdayDialog((current) => {
      window.requestAnimationFrame(() => current?.trigger.focus())
      return null
    })
  }, [])

  const changeMonth = useCallback((updateMonth: (month: Date) => Date) => {
    setBirthdayDialog(null)
    pendingScrollPosition.current = { x: window.scrollX, y: window.scrollY }
    setSelectedMonth((month) => {
      const nextMonth = updateMonth(month)
      navigate(getCalendarPath(nextMonth), { replace: true })
      return nextMonth
    })
  }, [navigate])

  useEffect(() => {
    if (!birthdayDialog) return

    birthdayCloseButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBirthdayDialog()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [birthdayDialog, closeBirthdayDialog])

  useLayoutEffect(() => {
    const scrollPosition = pendingScrollPosition.current
    if (!scrollPosition) return

    window.scrollTo(scrollPosition.x, scrollPosition.y)
    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo(scrollPosition.x, scrollPosition.y)
      pendingScrollPosition.current = null
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [selectedMonth])

  const loadBookings = useCallback(async () => {
    setLoadingState('loading')

    try {
      const response = await fetch('/.netlify/functions/read-bookings', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (response.status === 401) {
        window.location.replace('/login')
        return
      }

      if (!response.ok) throw new Error('Failed to load bookings')

      const body = await response.json() as { bookings?: unknown }
      if (!Array.isArray(body.bookings)) throw new Error('Invalid booking response')

      setBookings(
        body.bookings
          .map(normalizeBooking)
          .filter((booking): booking is Booking => booking !== null),
      )
      setLoadingState('ready')
    } catch {
      setLoadingState('error')
    }
  }, [])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  useEffect(() => {
    const calendarPath = getCalendarPath(selectedMonth)
    if (`${location.pathname}${location.search}` !== calendarPath) {
      navigate(calendarPath, { replace: true })
    }
  }, [location.pathname, location.search, navigate, selectedMonth])

  useLayoutEffect(() => {
    if (loadingState !== 'ready') return

    try {
      const storedValue = window.sessionStorage.getItem(calendarReturnStorageKey)
      if (!storedValue) return

      const returnState = JSON.parse(storedValue) as Partial<CalendarReturnState>
      const currentPath = `${location.pathname}${location.search}`
      if (
        returnState.path !== currentPath
        || typeof returnState.scrollX !== 'number'
        || typeof returnState.scrollY !== 'number'
      ) return

      window.sessionStorage.removeItem(calendarReturnStorageKey)
      window.scrollTo(returnState.scrollX, returnState.scrollY)
      const animationFrame = window.requestAnimationFrame(() => {
        window.scrollTo(returnState.scrollX as number, returnState.scrollY as number)
      })

      return () => window.cancelAnimationFrame(animationFrame)
    } catch {
      window.sessionStorage.removeItem(calendarReturnStorageKey)
    }
  }, [loadingState, location.pathname, location.search])

  const openBooking = useCallback((bookingId: string) => {
    const calendarPath = getCalendarPath(selectedMonth)
    const returnState: CalendarReturnState = {
      path: calendarPath,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    }

    try {
      window.sessionStorage.setItem(calendarReturnStorageKey, JSON.stringify(returnState))
    } catch {}

    navigate(getBookingDetailsPath(bookingId), { state: { calendarPath } })
  }, [navigate, selectedMonth])

  const calendarDays = getCalendarDays(selectedMonth)
  const isCurrentMonth = selectedMonth.getFullYear() === currentMonth.getFullYear()
    && selectedMonth.getMonth() === currentMonth.getMonth()

  return (
    <AppFrame showAccount>
      <button className="back-button" type="button" onClick={() => navigate('/booking')}>
        <span aria-hidden="true">←</span>
        Tilbake til booking
      </button>

      <div className="calendar-heading page-enter">
        <p className="eyebrow">Hyttekalender</p>
        <h1>Se hyttekalender</h1>
        <p>Her ser du hvem som har registrert tid på hytta.</p>
      </div>

      {loadingState === 'loading' && <CalendarLoading />}

      {loadingState === 'error' && (
        <div className="calendar-error" role="alert">
          <p>Kunne ikke hente hyttekalenderen. Sjekk forbindelsen og prøv igjen.</p>
          <button className="secondary-button" type="button" onClick={() => void loadBookings()}>
            Prøv igjen
          </button>
        </div>
      )}

      {loadingState === 'ready' && (
        <section className="calendar-section page-enter page-enter--delay" aria-labelledby="calendar-month-title">
          <div className="calendar-toolbar">
            <MonthButton direction="previous" onClick={() => changeMonth((month) => addMonths(month, -1))} />
            <h2 id="calendar-month-title" aria-live="polite">{monthFormatter.format(selectedMonth)}</h2>
            <MonthButton direction="next" onClick={() => changeMonth((month) => addMonths(month, 1))} />
            <button
              className="calendar-today-button"
              type="button"
              disabled={isCurrentMonth}
              onClick={() => changeMonth(() => currentMonth)}
            >
              I dag
            </button>
          </div>

          <div className="calendar-legend" aria-label="Familier i kalenderen">
            {familyMembers.map((familyMember) => {
              const owner = resolveBookingOwner(familyMember.id)
              return (
                <span className={`calendar-legend__item ${owner.styleClass}`} key={familyMember.id}>
                  <span className="calendar-owner-marker" aria-hidden="true">
                    {owner.marker}
                  </span>
                  <span className="calendar-legend__name calendar-legend__name--full">
                    {familyMember.displayName}
                  </span>
                  <span className="calendar-legend__name calendar-legend__name--compact">
                    {owner.legendName}
                  </span>
                </span>
              )
            })}
          </div>

          <div className="calendar-grid" role="grid" aria-labelledby="calendar-month-title">
            {norwegianWeekdays.map((weekday) => (
              <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>
            ))}

            {calendarDays.map((calendarDay) => {
              const dayBookings = getBookingsForDate(bookings, calendarDay.dateKey)
              const dayBirthdays = getBirthdaysForDate(calendarDay.date)
              const weekday = calendarDay.date.getDay()

              return (
                <div
                  className={`calendar-day${calendarDay.isCurrentMonth ? '' : ' calendar-day--outside'}${calendarDay.dateKey === todayKey ? ' calendar-day--today' : ''}`}
                  role="gridcell"
                  aria-label={fullDateFormatter.format(calendarDay.date)}
                  key={calendarDay.dateKey}
                >
                  <time dateTime={calendarDay.dateKey}>{calendarDay.date.getDate()}</time>
                  {dayBirthdays.length > 0 && (
                    <button
                      type="button"
                      className="calendar-birthday-indicator"
                      aria-label={getBirthdayIndicatorLabel(dayBirthdays)}
                      title={getBirthdayIndicatorLabel(dayBirthdays)}
                      onClick={(event) => setBirthdayDialog({
                        birthdays: dayBirthdays,
                        trigger: event.currentTarget,
                      })}
                    >
                      <span className="calendar-birthday-indicator__portraits" aria-hidden="true">
                        {dayBirthdays.slice(0, 3).map((birthday) => (
                          <ProfileImage
                            key={`${birthday.familyId}-${birthday.id}`}
                            familyId={birthday.familyId}
                            memberId={birthday.id}
                            variant="member"
                            alt=""
                            className="calendar-birthday-portrait"
                          />
                        ))}
                        {dayBirthdays.length > 3 && (
                          <span className="calendar-birthday-indicator__more">+{dayBirthdays.length - 3}</span>
                        )}
                      </span>
                      <span className="calendar-birthday-indicator__cue" aria-hidden="true"><BirthdayIcon /></span>
                    </button>
                  )}
                  <div className="calendar-day__bookings">
                    {dayBookings.map((booking) => {
                      const owner = resolveBookingOwner(booking.ownerId)
                      const continuesBefore = booking.fromDate < calendarDay.dateKey && weekday !== 1
                      const continuesAfter = booking.toDate > calendarDay.dateKey && weekday !== 0
                      const classNames = [
                        'calendar-booking',
                        owner.styleClass,
                        continuesBefore ? 'calendar-booking--continues-before' : '',
                        continuesAfter ? 'calendar-booking--continues-after' : '',
                      ].filter(Boolean).join(' ')
                      const welcomeText = booking.welcomesOthers ? ', ønsker gjerne flere med' : ''

                      return (
                        <button
                          type="button"
                          className={classNames}
                          key={booking.id}
                          aria-label={`Se registreringen til ${owner.displayName}${welcomeText}`}
                          title={`${owner.displayName}${welcomeText}`}
                          onClick={() => openBooking(booking.id)}
                        >
                          <span className="calendar-owner-marker" aria-hidden="true">{owner.marker}</span>
                          <span className="calendar-booking__compact" aria-hidden="true">{owner.compactName}</span>
                          <span className="calendar-booking__full" aria-hidden="true">{owner.displayName}</span>
                          {booking.welcomesOthers && (
                            <span className="calendar-booking__welcome" aria-label="Ønsker gjerne flere med">+</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {!hasBookingsInMonth(bookings, selectedMonth) && (
            <p className="calendar-empty" role="status">Ingen registrerte tider denne måneden.</p>
          )}
        </section>
      )}

      {birthdayDialog && (
        <div className="birthday-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeBirthdayDialog()
        }}>
          <section
            className="birthday-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-dialog-title"
          >
            {birthdayDialog.birthdays.length === 1 ? (
              <div className="birthday-dialog__person birthday-dialog__person--single">
                <ProfileImage
                  familyId={birthdayDialog.birthdays[0].familyId}
                  memberId={birthdayDialog.birthdays[0].id}
                  variant="member"
                  alt=""
                  className="birthday-dialog__portrait"
                />
                <h2 id="birthday-dialog-title">
                  {getBirthdayDescription(birthdayDialog.birthdays[0].displayName)}
                </h2>
              </div>
            ) : (
              <>
                <h2 id="birthday-dialog-title">Bursdager</h2>
                <ul>
                  {birthdayDialog.birthdays.map((birthday) => (
                    <li key={`${birthday.familyId}-${birthday.id}`}>
                      <ProfileImage
                        familyId={birthday.familyId}
                        memberId={birthday.id}
                        variant="member"
                        alt=""
                        className="birthday-dialog__portrait"
                      />
                      <span>{getBirthdayDescription(birthday.displayName)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              ref={birthdayCloseButtonRef}
              className="secondary-button birthday-dialog__close"
              type="button"
              onClick={closeBirthdayDialog}
            >
              Lukk
            </button>
          </section>
        </div>
      )}
    </AppFrame>
  )
}
