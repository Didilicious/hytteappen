// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, Link } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import AppFrame from '../src/components/AppFrame'
import { SectionProvider, useSection } from '../src/sections'

vi.mock('../src/components/AccountMenu', () => ({ default: () => null }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Screen() {
  const section = useSection()
  const location = useLocation()
  return <AppFrame showAccount><output>{section ?? 'landing'}:{location.pathname}</output><Link to="/noticeboard">Oppslagstavle</Link><Link to="/guide/cabin-operations">Drift av hytte</Link></AppFrame>
}

it('keeps the active section on shared pages and allows switching and returning to the landing page', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/familien']}><SectionProvider><Routes><Route path="*" element={<Screen />} /></Routes></SectionProvider></MemoryRouter>))
    const click = async (href: string) => {
      await act(async () => container.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!.click())
    }
    const selectSection = async (value: string) => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Velg seksjon"]')!
      await act(async () => {
        select.value = value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
    expect(container.querySelector('output')?.textContent).toBe('familien:/familien')
    await click('/noticeboard')
    expect(container.querySelector('output')?.textContent).toBe('familien:/noticeboard')
    await selectSection('/familien')
    expect(container.querySelector('output')?.textContent).toBe('familien:/familien')
    await selectSection('/hytta')
    expect(container.querySelector('output')?.textContent).toBe('hytta:/hytta')
    await click('/noticeboard')
    expect(container.querySelector('output')?.textContent).toBe('hytta:/noticeboard')
    // The displayed section is a prompt, so selecting that same section changes the value.
    expect(container.querySelector<HTMLSelectElement>('.section-select')?.value).toBe('')
    await selectSection('/hytta')
    expect(container.querySelector('output')?.textContent).toBe('hytta:/hytta')
    await click('/guide/cabin-operations')
    expect(container.querySelector('output')?.textContent).toBe('hytta:/guide/cabin-operations')
    await selectSection('/hytta')
    expect(container.querySelector('output')?.textContent).toBe('hytta:/hytta')
    await selectSection('/')
    expect(container.querySelector('output')?.textContent).toBe('landing:/')
    expect(container.querySelector<HTMLSelectElement>('.section-select')?.value).toBe('')
  } finally {
    act(() => root.unmount())
  }
})
