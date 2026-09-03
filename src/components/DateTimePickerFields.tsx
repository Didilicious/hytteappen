import { useEffect, useMemo, useRef, useState } from 'react'

type DatePickerFieldProps = {
  id: string
  label: string
  value: string
  min?: string
  required?: boolean
  error?: string
  onChange: (value: string) => void
}

type TimePickerFieldProps = {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}

const weekdayLabels = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))
const monthFormatter = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' })
const dateFormatter = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

function formatDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
}

function getIsoWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function calendarWeeks(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12)
  const firstVisibleDay = startOfWeek(firstDay)
  const lastVisibleDay = startOfWeek(lastDay)
  lastVisibleDay.setDate(lastVisibleDay.getDate() + 6)
  const weeks: Date[][] = []
  const cursor = new Date(firstVisibleDay)

  while (cursor <= lastVisibleDay) {
    const week = Array.from({ length: 7 }, () => {
      const day = new Date(cursor)
      cursor.setDate(cursor.getDate() + 1)
      return day
    })
    weeks.push(week)
  }

  return weeks
}

function useDismissablePicker(open: boolean, close: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, open])

  return containerRef
}

export function DatePickerField({ id, label, value, min, required, error, onChange }: DatePickerFieldProps) {
  const selectedDate = parseDate(value)
  const minimumDate = min ? parseDate(min) : null
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? minimumDate ?? new Date())
  const containerRef = useDismissablePicker(open, () => setOpen(false))
  const weeks = useMemo(() => calendarWeeks(visibleMonth), [visibleMonth])
  const todayValue = formatDateValue(new Date())
  const popoverId = `${id}-picker`

  function openPicker() {
    setVisibleMonth(selectedDate ?? minimumDate ?? new Date())
    setOpen(true)
  }

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12))
  }

  const previousMonthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0, 12)
  const previousDisabled = Boolean(minimumDate && previousMonthEnd < minimumDate)

  return (
    <div className="field-group picker-field" ref={containerRef}>
      <label id={`${id}-label`}>{label}</label>
      <input id={id} type="hidden" value={value} required={required} aria-labelledby={`${id}-label`} />
      <button
        className="picker-field__trigger"
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-invalid={Boolean(error)}
        onClick={() => open ? setOpen(false) : openPicker()}
      >
        <span id={`${id}-value`} className={value ? undefined : 'picker-field__placeholder'}>
          {selectedDate ? dateFormatter.format(selectedDate) : 'Velg dato'}
        </span>
        <span className="picker-field__icon" aria-hidden="true">▦</span>
      </button>
      {open && (
        <div className="date-picker" id={popoverId} role="dialog" aria-label={`Velg ${label.toLocaleLowerCase('nb-NO')}`}>
          <div className="date-picker__header">
            <button type="button" onClick={() => changeMonth(-1)} disabled={previousDisabled} aria-label="Forrige måned">‹</button>
            <strong aria-live="polite">{monthFormatter.format(visibleMonth)}</strong>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Neste måned">›</button>
          </div>
          <table className="date-picker__calendar">
            <thead>
              <tr>
                <th className="date-picker__week-heading" scope="col">Uke</th>
                {weekdayLabels.map((weekday) => <th key={weekday} scope="col">{weekday}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={formatDateValue(week[0])}>
                  <th className="date-picker__week" scope="row">{getIsoWeek(week[0])}</th>
                  {week.map((day) => {
                    const dayValue = formatDateValue(day)
                    const outsideMonth = day.getMonth() !== visibleMonth.getMonth()
                    const disabled = Boolean(min && dayValue < min)
                    return (
                      <td key={dayValue}>
                        <button
                          className={[
                            'date-picker__day',
                            outsideMonth ? 'date-picker__day--outside' : '',
                            dayValue === value ? 'date-picker__day--selected' : '',
                            dayValue === todayValue ? 'date-picker__day--today' : '',
                          ].filter(Boolean).join(' ')}
                          type="button"
                          disabled={disabled}
                          aria-label={dateFormatter.format(day)}
                          aria-pressed={dayValue === value}
                          onClick={() => {
                            onChange(dayValue)
                            setOpen(false)
                          }}
                        >
                          {day.getDate()}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>
  )
}

export function TimePickerField({ id, label, value, error, onChange }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState('12')
  const [draftMinute, setDraftMinute] = useState('00')
  const containerRef = useDismissablePicker(open, () => setOpen(false))
  const popoverId = `${id}-picker`

  function openPicker() {
    const [hour = '12', minute = '00'] = value.split(':')
    setDraftHour(hours.includes(hour) ? hour : '12')
    setDraftMinute(minutes.includes(minute) ? minute : '00')
    setOpen(true)
  }

  return (
    <div className="field-group picker-field" ref={containerRef}>
      <label id={`${id}-label`}>{label}</label>
      <input id={id} type="hidden" value={value} aria-labelledby={`${id}-label`} />
      <button
        className="picker-field__trigger"
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-invalid={Boolean(error)}
        onClick={() => open ? setOpen(false) : openPicker()}
      >
        <span id={`${id}-value`} className={value ? 'picker-field__time-value' : 'picker-field__placeholder'}>
          {value || 'Velg tidspunkt'}
        </span>
        <span className="picker-field__icon" aria-hidden="true">◷</span>
      </button>
      {open && (
        <div className="time-picker" id={popoverId} role="dialog" aria-label={`Velg ${label.toLocaleLowerCase('nb-NO')}`}>
          <div className="time-picker__heading" aria-live="polite">{draftHour}:{draftMinute}</div>
          <div className="time-picker__columns">
            <div className="time-picker__column" aria-label="Timer">
              <strong>Timer</strong>
              <div className="time-picker__options">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-pressed={draftHour === hour}
                    onClick={() => setDraftHour(hour)}
                  >
                    {hour}
                  </button>
                ))}
              </div>
            </div>
            <div className="time-picker__column" aria-label="Minutter">
              <strong>Minutter</strong>
              <div className="time-picker__options">
                {minutes.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    aria-pressed={draftMinute === minute}
                    onClick={() => setDraftMinute(minute)}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            className="time-picker__done"
            type="button"
            onClick={() => {
              onChange(`${draftHour}:${draftMinute}`)
              setOpen(false)
            }}
          >
            Ferdig
          </button>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>
  )
}
