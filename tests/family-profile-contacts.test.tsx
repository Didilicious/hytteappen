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
  uploadProfileImage: vi.fn(),
  loadProfileImageSource: vi.fn(),
  createCroppedProfileImage: vi.fn(),
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

vi.mock('../src/profileImages', () => ({
  PROFILE_IMAGE_ACCEPT: 'image/jpeg,image/png,image/webp',
  PROFILE_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
  getProfileImageUrl: ({ familyId, memberId }: { familyId: string; memberId?: string }, version?: string) => {
    const suffix = memberId ? `&memberId=${memberId}` : ''
    const cacheBust = version ? `&v=${version}` : ''
    return `/.netlify/functions/profile-image?familyId=${familyId}${suffix}${cacheBust}`
  },
  getProfileImageVersion: () => undefined,
  subscribeToProfileImageVersion: () => () => {},
  uploadProfileImage: state.uploadProfileImage,
}));

vi.mock('../src/profileImageProcessing', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/profileImageProcessing')>()
  return {
    ...original,
    validateProfileImageSource: vi.fn(),
    loadProfileImageSource: state.loadProfileImageSource,
    createCroppedProfileImage: state.createCroppedProfileImage,
  }
});

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
    const image = document.createElement('img')
    state.currentUser = { id: 'heidi', displayName: 'Heidi' }
    state.readFamilyProfiles.mockReset().mockResolvedValue([auroraProfile])
    state.updateMemberProfile.mockReset()
    state.uploadProfileImage.mockReset()
    state.loadProfileImageSource.mockReset().mockResolvedValue({
      image,
      url: 'blob:profile-preview',
      width: 2000,
      height: 1000,
      dispose: vi.fn(),
    })
    state.createCroppedProfileImage.mockReset().mockResolvedValue(
      new File([new Uint8Array([4, 5, 6])], 'profilbilde.webp', { type: 'image/webp' }),
    )
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

  it('shows the code-defined birthday without a birth year or edit control', async () => {
    const container = await renderProfile()
    const heidiCard = [...container.querySelectorAll<HTMLElement>('.family-member-card')]
      .find((card) => card.querySelector('h3')?.textContent === 'Heidi')
    const birthday = heidiCard?.querySelector('.family-member-birthday')

    expect(birthday?.textContent).toContain('Bursdag')
    expect(birthday?.textContent).toContain('6. februar')
    expect(birthday?.textContent).not.toMatch(/\b\d{4}\b/)
    expect(heidiCard?.querySelector('input[name*="birthday"], button[aria-label*="bursdag" i]')).toBeNull()
  })

  it('shows the family and member pictures with neutral placeholders as fallback', async () => {
    const container = await renderProfile()
    const familyImage = container.querySelector<HTMLImageElement>('img[alt="Familiebilde for Heidi"]')
    const memberImage = container.querySelector<HTMLImageElement>('img[alt="Profilbilde av Aurora"]')

    expect(familyImage?.src).toContain('familyId=heidi')
    expect(memberImage?.src).toContain('familyId=heidi&memberId=aurora')
    expect(memberImage?.parentElement?.querySelector('.profile-placeholder--member')).not.toBeNull()

    await act(async () => memberImage?.dispatchEvent(new Event('error')))
    expect(container.querySelector('img[alt="Profilbilde av Aurora"]')).toBeNull()
    expect(container.querySelector('.profile-placeholder--member')).not.toBeNull()
  })

  it('opens the shared crop dialog and updates a member picture immediately', async () => {
    state.uploadProfileImage.mockResolvedValue('2026-08-13T13:00:00.000Z')
    const container = await renderProfile()
    const auroraCard = [...container.querySelectorAll<HTMLElement>('.family-member-card')]
      .find((card) => card.querySelector('h3')?.textContent === 'Aurora')
    const input = auroraCard?.querySelector<HTMLInputElement>('input[type="file"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'aurora.jpg', { type: 'image/jpeg' })

    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()

    const dialog = document.querySelector<HTMLDialogElement>('.profile-crop-dialog')
    expect(dialog?.textContent).toContain('Velg utsnitt')
    expect(state.uploadProfileImage).not.toHaveBeenCalled()

    const useButton = [...dialog!.querySelectorAll('button')].find((button) => button.textContent === 'Bruk bilde')
    await act(async () => useButton?.click())
    await settle()

    const processedFile = state.createCroppedProfileImage.mock.results[0].value
    await expect(processedFile).resolves.toMatchObject({ name: 'profilbilde.webp', type: 'image/webp' })
    expect(state.uploadProfileImage).toHaveBeenCalledWith(
      { familyId: 'heidi', memberId: 'aurora' },
      expect.objectContaining({ name: 'profilbilde.webp', type: 'image/webp' }),
    )
    expect(auroraCard?.querySelector<HTMLImageElement>('img')?.src).toContain('v=2026-08-13T13:00:00.000Z')
    expect(auroraCard?.textContent).toContain('Bildet er oppdatert.')
    expect(document.querySelector('.profile-crop-dialog')).toBeNull()
  })

  it('repositions and zooms the crop before processing', async () => {
    state.uploadProfileImage.mockResolvedValue('2026-08-13T13:00:00.000Z')
    const container = await renderProfile()
    const input = container.querySelector<HTMLInputElement>('.family-profile-heading input[type="file"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'familie.jpg', { type: 'image/jpeg' })

    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()

    const viewport = document.querySelector<HTMLElement>('.profile-crop-dialog__viewport')!
    const image = viewport.querySelector<HTMLImageElement>('img')!
    const initialTransform = image.style.transform

    await act(async () => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(image.style.transform).not.toBe(initialTransform)

    const zoomButton = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom inn"]')!
    const movedTransform = image.style.transform
    await act(async () => zoomButton.click())
    expect(image.style.transform).not.toBe(movedTransform)
  })

  it('cancels the shared crop flow without uploading', async () => {
    const container = await renderProfile()
    const input = container.querySelector<HTMLInputElement>('.family-profile-heading input[type="file"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'familie.png', { type: 'image/png' })

    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()

    const cancelButton = [...document.querySelectorAll<HTMLButtonElement>('.profile-crop-dialog button')]
      .find((button) => button.textContent === 'Avbryt')
    await act(async () => cancelButton?.click())

    expect(state.createCroppedProfileImage).not.toHaveBeenCalled()
    expect(state.uploadProfileImage).not.toHaveBeenCalled()
    expect(document.querySelector('.profile-crop-dialog')).toBeNull()
  })

  it('keeps the family crop open and existing picture when upload fails', async () => {
    state.uploadProfileImage.mockRejectedValue(new Error('Opplastingen feilet. Prøv igjen.'))
    const container = await renderProfile()
    const familyImageBefore = container.querySelector<HTMLImageElement>('img[alt="Familiebilde for Heidi"]')?.src
    const familyInput = container.querySelector<HTMLInputElement>('.family-profile-heading input[type="file"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'familie.png', { type: 'image/png' })

    Object.defineProperty(familyInput, 'files', { configurable: true, value: [file] })
    await act(async () => familyInput?.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()

    const useButton = [...document.querySelectorAll<HTMLButtonElement>('.profile-crop-dialog button')]
      .find((button) => button.textContent === 'Bruk bilde')
    await act(async () => useButton?.click())
    await settle()

    expect(container.querySelector<HTMLImageElement>('img[alt="Familiebilde for Heidi"]')?.src).toBe(familyImageBefore)
    expect(document.querySelector('.profile-crop-dialog')?.textContent).toContain('Opplastingen feilet. Prøv igjen.')
    expect(document.querySelector('.profile-crop-dialog')).not.toBeNull()
  })

  it('keeps the existing picture when crop processing fails', async () => {
    state.createCroppedProfileImage.mockRejectedValue(new Error('Bildet kunne ikke behandles. Prøv igjen.'))
    const container = await renderProfile()
    const memberImageBefore = container.querySelector<HTMLImageElement>('img[alt="Profilbilde av Aurora"]')?.src
    const input = [...container.querySelectorAll<HTMLElement>('.family-member-card')]
      .find((card) => card.querySelector('h3')?.textContent === 'Aurora')
      ?.querySelector<HTMLInputElement>('input[type="file"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'aurora.webp', { type: 'image/webp' })

    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()

    const useButton = [...document.querySelectorAll<HTMLButtonElement>('.profile-crop-dialog button')]
      .find((button) => button.textContent === 'Bruk bilde')
    await act(async () => useButton?.click())
    await settle()

    expect(state.uploadProfileImage).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLImageElement>('img[alt="Profilbilde av Aurora"]')?.src).toBe(memberImageBefore)
    expect(document.querySelector('.profile-crop-dialog')?.textContent).toContain('Bildet kunne ikke behandles. Prøv igjen.')
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
