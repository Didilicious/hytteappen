// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberProfile } from '../shared/memberProfiles'
import FamilyProfilePage from '../src/pages/FamilyProfilePage'

const state = vi.hoisted(() => ({
  currentUser: { id: 'heidi', displayName: 'Heidi' } as { id: string; displayName: string },
  readFamilyProfiles: vi.fn(),
  updateMemberProfile: vi.fn(),
}))

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    currentUser: state.currentUser,
    login: vi.fn(),
    logout: vi.fn(),
    expireSession: vi.fn(),
  }),
}));

vi.mock('../src/memberProfiles', () => ({
  readFamilyProfiles: state.readFamilyProfiles,
  updateMemberProfile: state.updateMemberProfile,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const auroraProfile: MemberProfile = {
  familyId: 'heidi',
  memberId: 'aurora',
  phones: [
    { id: 'phone-1', label: 'Mobil', value: '+47 123 45 678' },
    { id: 'phone-2', label: 'Jobb', value: '+47 987 65 432' },
  ],
  emails: [{ id: 'email-1', label: '', value: 'aurora@example.no' }],
  addresses: [{ id: 'address-1', label: 'Hos mamma', value: 'Eksempelveien 12\n0123 Oslo' }],
  updatedAt: '2026-08-13T12:00:00.000Z',
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('family profile contact UI', () => {
  let root: ReturnType<typeof createRoot> | undefined

  beforeEach(() => {
    state.currentUser = { id: 'heidi', displayName: 'Heidi' }
    state.readFamilyProfiles.mockReset().mockResolvedValue([auroraProfile])
    state.updateMemberProfile.mockReset()
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  async function renderProfile(familyId = 'heidi') {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[`/familieoversikt/${familyId}`]}>
          <Routes>
            <Route path="/familieoversikt/:familyId" element={<FamilyProfilePage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await settle()
    return container
  }

  it('shows compact contact sections, tel/mailto links, labels, and multiline addresses', async () => {
    const container = await renderProfile()

    expect(container.querySelector('a[href="tel:+47 123 45 678"]')?.textContent).toBe('+47 123 45 678')
    expect(container.querySelector('a[href="mailto:aurora@example.no"]')?.textContent).toBe('aurora@example.no')
    expect(container.textContent).toContain('Mobil')
    expect(container.textContent).toContain('Hos mamma')
    expect(container.querySelector('.member-contact-item__address')?.textContent).toBe('Eksempelveien 12\n0123 Oslo')
  })

  it('hides empty sections and edit actions when viewing another family', async () => {
    state.currentUser = { id: 'heidi', displayName: 'Heidi' }
    state.readFamilyProfiles.mockResolvedValue([{
      familyId: 'christine',
      memberId: 'christine',
      phones: [{ id: 'phone', label: '', value: '99 88 77 66' }],
      emails: [],
      addresses: [],
      updatedAt: null,
    }])

    const container = await renderProfile('christine')
    const headings = [...container.querySelectorAll('.member-contact-section h4')].map((heading) => heading.textContent)

    expect(headings).toEqual(['Telefon'])
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Rediger')).toBe(false)
  })

  it('removes one contact entry without removing the family member', async () => {
    state.updateMemberProfile.mockResolvedValue({
      ...auroraProfile,
      phones: [auroraProfile.phones[1]],
    })
    const container = await renderProfile()
    const auroraCard = [...container.querySelectorAll<HTMLElement>('.family-member-card')]
      .find((card) => card.querySelector('h3')?.textContent === 'Aurora')

    await act(async () => auroraCard?.querySelector<HTMLButtonElement>('.family-member-card__edit')?.click())
    await act(async () => auroraCard?.querySelector<HTMLButtonElement>('button[aria-label="Fjern telefonnummer 1"]')?.click())
    await act(async () => auroraCard?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())
    await settle()

    expect(state.updateMemberProfile).toHaveBeenCalledWith('heidi', 'aurora', expect.objectContaining({
      phones: [auroraProfile.phones[1]],
    }))
    expect(auroraCard?.querySelector('h3')?.textContent).toBe('Aurora')
    expect(auroraCard?.querySelector('a[href="tel:+47 987 65 432"]')).not.toBeNull()
    expect(auroraCard?.textContent).toContain('Endringene er lagret.')
  })

  it('preserves entered form data when saving fails', async () => {
    state.readFamilyProfiles.mockResolvedValue([])
    state.updateMemberProfile.mockRejectedValue(new Error('Lagringen feilet. Prøv igjen.'))
    const container = await renderProfile()
    const heidiCard = [...container.querySelectorAll<HTMLElement>('.family-member-card')]
      .find((card) => card.querySelector('h3')?.textContent === 'Heidi')

    await act(async () => heidiCard?.querySelector<HTMLButtonElement>('.family-member-card__edit')?.click())
    const addPhone = [...heidiCard?.querySelectorAll<HTMLButtonElement>('.member-contact-editor__add') ?? []]
      .find((button) => button.textContent === '+ Legg til telefonnummer')
    await act(async () => addPhone?.click())

    const phoneInput = heidiCard?.querySelector<HTMLInputElement>('input[aria-label="Telefonnummer 1, verdi"]')
    await act(async () => {
      if (!phoneInput) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(phoneInput, '+47 400 00 000')
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => heidiCard?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())
    await settle()

    expect(heidiCard?.querySelector<HTMLInputElement>('input[aria-label="Telefonnummer 1, verdi"]')?.value).toBe('+47 400 00 000')
    expect(heidiCard?.textContent).toContain('Lagringen feilet. Prøv igjen.')
  })
})
