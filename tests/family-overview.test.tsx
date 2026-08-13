// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { familyMembers as loginAccounts } from '../shared/familyMembers'
import App from '../src/App'
import { families } from '../src/families'

const authState = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' }))

vi.mock('../src/auth', () => ({
  familyMembers: [
    { id: 'anne-jan', displayName: 'Anne Marie & Jan' },
    { id: 'christine', displayName: 'Christine' },
    { id: 'anette', displayName: 'Anette' },
    { id: 'mads', displayName: 'Mads' },
    { id: 'heidi', displayName: 'Heidi' },
  ],
  useAuth: () => ({
    status: authState.status,
    currentUser: authState.status === 'authenticated'
      ? { id: 'anette', displayName: 'Anette' }
      : null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function LocationPath() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

async function flushNavigation() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('Familieoversikt', () => {
  let root: ReturnType<typeof createRoot> | undefined

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ profiles: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    authState.status = 'authenticated'
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderApp(path: string) {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <App />
          <LocationPath />
        </MemoryRouter>,
      )
    })
    await flushNavigation()
    return container
  }

  it('requires authentication', async () => {
    authState.status = 'anonymous'

    const container = await renderApp('/familieoversikt')

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/login')
    expect(container.textContent).toContain('Velkommen til hytteguiden')
  })

  it('shows all five families with the correct members', async () => {
    const container = await renderApp('/familieoversikt')
    const familyCards = [...container.querySelectorAll<HTMLAnchorElement>('.family-card')]

    expect(familyCards).toHaveLength(5)
    families.forEach((family) => {
      const card = familyCards.find((candidate) => candidate.getAttribute('href') === `/familieoversikt/${family.accountId}`)
      expect(card?.textContent).toContain(family.displayName)
      family.members.forEach((member) => expect(card?.textContent).toContain(member.displayName))
    })
  })

  it('shows family pictures on overview cards with placeholders underneath', async () => {
    const container = await renderApp('/familieoversikt')
    const heidiCard = container.querySelector<HTMLAnchorElement>('a[href="/familieoversikt/heidi"]')
    const image = heidiCard?.querySelector<HTMLImageElement>('img[alt="Familiebilde for Heidi"]')

    expect(image?.src).toContain('/.netlify/functions/profile-image?familyId=heidi')
    expect(heidiCard?.querySelector('.profile-placeholder--family')).not.toBeNull()
  })

  it('opens a family profile from the overview', async () => {
    const container = await renderApp('/familieoversikt')
    const madsLink = container.querySelector<HTMLAnchorElement>('a[href="/familieoversikt/mads"]')

    act(() => madsLink?.click())
    await flushNavigation()

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/familieoversikt/mads')
    expect(container.querySelector('.family-profile-heading')?.textContent).toContain('Mads')
    ;['Mads', 'Benedickte', 'Kristian', 'Casper', 'Phillip'].forEach((name) => {
      expect(container.querySelector('.family-member-section')?.textContent).toContain(name)
    })
  })

  it('supports direct navigation to a family profile', async () => {
    const container = await renderApp('/familieoversikt/christine')

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/familieoversikt/christine')
    expect(container.querySelector('.family-profile-heading')?.textContent).toContain('Christine')
    ;['Christine', 'Othelie', 'Emilie', 'Mathilde'].forEach((name) => {
      expect(container.querySelector('.family-member-section')?.textContent).toContain(name)
    })
  })

  it('shows a calm not-found state for an unknown family ID', async () => {
    const container = await renderApp('/familieoversikt/ukjent-familie')

    expect(container.textContent).toContain('Familien ble ikke funnet')
    expect(container.textContent).toContain('Familien finnes ikke i oversikten')
    expect(container.querySelector('a[href="/familieoversikt"]')).not.toBeNull()
  })

  it('keeps person records separate from the five login accounts', () => {
    expect(loginAccounts.map((account) => account.id)).toEqual(families.map((family) => family.accountId))
    expect(loginAccounts).toHaveLength(5)
    expect(families.flatMap((family) => family.members)).toHaveLength(18)
    expect(loginAccounts.some((account) => account.id === 'jan')).toBe(false)
    expect(loginAccounts.some((account) => account.id === 'othelie')).toBe(false)
    expect(loginAccounts.some((account) => account.id === 'aurora')).toBe(false)
  })

  it('uses explicit stable member IDs', () => {
    const memberIds = families.flatMap((family) => family.members.map((member) => member.id))

    expect(memberIds).toContain('anne-marie')
    expect(memberIds).toContain('benedickte')
    expect(memberIds).toContain('aurora')
    expect(new Set(memberIds).size).toBe(memberIds.length)
    memberIds.forEach((memberId) => expect(memberId).toMatch(/^[a-z0-9-]+$/))
  })
})
