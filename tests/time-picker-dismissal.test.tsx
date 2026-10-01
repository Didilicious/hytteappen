// @vitest-environment happy-dom

import { act, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimePickerField } from '../src/components/DateTimePickerFields'
import FamilyEventForm from '../src/components/FamilyEventForm'

vi.mock('../src/components/AppFrame', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Picker({ initialValue, onChange }: { initialValue: string; onChange: (value: string) => void }) {
  const [value, setValue] = useState(initialValue)
  return <TimePickerField id="event-time" label="Tidspunkt" value={value} onChange={(nextValue) => { setValue(nextValue); onChange(nextValue) }} />
}

describe('time picker dismissal', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  async function render(content: ReactNode) {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter>{content}</MemoryRouter>))
    return container
  }

  function selectNumber(container: Element, column: string, value: string) {
    const button = [...container.querySelectorAll<HTMLButtonElement>(`.time-picker__column[aria-label="${column}"] button`)].find((entry) => entry.textContent === value)!
    act(() => button.click())
  }

  function clickOutside() {
    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  }

  it.each([
    { initialValue: '', hour: '18', minute: '', expected: '18:00' },
    { initialValue: '', hour: '', minute: '45', expected: '12:45' },
    { initialValue: '', hour: '18', minute: '45', expected: '18:45' },
    { initialValue: '', hour: '12', minute: '', expected: '12:00' },
    { initialValue: '16:20', hour: '18', minute: '', expected: '18:20' },
    { initialValue: '16:20', hour: '', minute: '45', expected: '16:45' },
  ])('commits $expected on outside dismissal after selecting a number', async ({ initialValue, hour, minute, expected }) => {
    const onChange = vi.fn()
    const container = await render(<Picker initialValue={initialValue} onChange={onChange} />)
    act(() => container.querySelector<HTMLButtonElement>('.picker-field__trigger')!.click())
    if (hour) selectNumber(container, 'Timer', hour)
    if (minute) selectNumber(container, 'Minutter', minute)
    expect(onChange).not.toHaveBeenCalled()
    clickOutside()
    expect(onChange).toHaveBeenCalledExactlyOnceWith(expected)
    expect(container.querySelector<HTMLInputElement>('#event-time')?.value).toBe(expected)
    expect(container.querySelector('.time-picker')).toBeNull()
  })

  it.each(['', '16:20'])('does not commit an untouched picker with initial value %j', async (initialValue) => {
    const onChange = vi.fn()
    const container = await render(<Picker initialValue={initialValue} onChange={onChange} />)
    act(() => container.querySelector<HTMLButtonElement>('.picker-field__trigger')!.click())
    clickOutside()
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLInputElement>('#event-time')?.value).toBe(initialValue)
  })

  it('resets the selection flag each time the picker opens', async () => {
    const onChange = vi.fn()
    const container = await render(<Picker initialValue="" onChange={onChange} />)
    const trigger = container.querySelector<HTMLButtonElement>('.picker-field__trigger')!
    act(() => trigger.click())
    selectNumber(container, 'Timer', '18')
    clickOutside()
    act(() => trigger.click())
    clickOutside()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('18:00')
  })

  it('keeps Escape dismissal from committing a draft', async () => {
    const onChange = vi.fn()
    const container = await render(<Picker initialValue="16:20" onChange={onChange} />)
    act(() => container.querySelector<HTMLButtonElement>('.picker-field__trigger')!.click())
    selectNumber(container, 'Timer', '18')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('.time-picker')).toBeNull()
  })

  it('commits both event times when saving without clicking Ferdig', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const container = await render(<FamilyEventForm title="Nytt familiearrangement" ownerId="mads" ownerName="Mads"
      initialValues={{ eventType: 'family-dinner', title: 'Familiemiddag', startDate: '2026-10-18', endDate: null, startTime: '', endTime: '', location: '', wishlistUrl: '', moreInfo: '' }}
      submitLabel="Lagre" submittingLabel="Lagrer …" onSubmit={onSubmit} onCancel={vi.fn()} />)
    act(() => container.querySelector<HTMLButtonElement>('[aria-controls="event-start-time-picker"]')!.click())
    selectNumber(container, 'Timer', '16')
    const addEndTime = [...container.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === '+ Legg til Slutt-tid')!
    act(() => addEndTime.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    act(() => addEndTime.click())
    act(() => container.querySelector<HTMLButtonElement>('[aria-controls="event-end-time-picker"]')!.click())
    selectNumber(container, 'Timer', '19')
    selectNumber(container, 'Minutter', '30')
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    act(() => submit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    await act(async () => submit.click())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ startTime: '16:00', endTime: '19:30' }))
  })
})
