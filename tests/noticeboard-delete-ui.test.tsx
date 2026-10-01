// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoticeboardPostPage from '../src/pages/NoticeboardPostPage'
import type { NoticeboardPost } from '../shared/noticeboard'

const auth = vi.hoisted(() => ({ currentUser: { id: 'mads', displayName: 'Mads' }, expireSession: vi.fn() }))
const noticeboard = vi.hoisted(() => ({ loadNoticeboardPost: vi.fn(), loadNoticeboardComments: vi.fn(), createNoticeboardComment: vi.fn() }))
vi.mock('../src/auth', () => ({ useAuth: () => auth }))
vi.mock('../src/noticeboard', () => noticeboard)
vi.mock('../src/components/AppFrame', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../src/components/ProfileImage', () => ({ default: () => null }))
vi.mock('../src/components/FamilyEventInvitationCard', () => ({ default: () => null }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const post: NoticeboardPost = {
  id: '123e4567-e89b-42d3-a456-426614174000', ownerId: 'mads', type: 'Info', title: 'Familiemiddag', description: 'Ta med dessert!',
  eventId: '223e4567-e89b-42d3-a456-426614174000', status: 'open', createdAt: '', updatedAt: '',
}

function Location() {
  return <output>{useLocation().pathname}</output>
}

describe('noticeboard deletion confirmation', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
    auth.currentUser = { id: 'mads', displayName: 'Mads' }
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  async function render(status = 204) {
    noticeboard.loadNoticeboardPost.mockResolvedValue({ post, comments: [] })
    const fetchMock = vi.fn().mockResolvedValue(new Response(status === 204 ? null : JSON.stringify({ message: 'Kunne ikke slette innlegget.' }), { status }))
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root?.render(<MemoryRouter initialEntries={[`/noticeboard/${post.id}`]}>
      <Routes><Route path="/noticeboard/:postId" element={<NoticeboardPostPage />} /><Route path="/noticeboard" element={<p>Oppslagstavle</p>} /></Routes><Location />
    </MemoryRouter>))
    return { container, fetchMock }
  }

  function button(container: Element, label: string) {
    return [...container.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === label)!
  }

  it('places Slett next to Rediger innlegg only for the owner', async () => {
    const { container } = await render()
    const deleteButton = button(container, 'Slett')
    expect(deleteButton.previousElementSibling?.textContent).toBe('Rediger innlegg')
    expect(deleteButton.parentElement?.className).toBe('noticeboard-post-actions')
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('does not show editing or deletion actions to another family', async () => {
    auth.currentUser = { id: 'anette', displayName: 'Anette' }
    const { container } = await render()
    expect(button(container, 'Slett')).toBeUndefined()
    expect(button(container, 'Rediger innlegg')).toBeUndefined()
  })

  it('opens the usual confirmation and leaves the post intact when cancelled', async () => {
    const { container, fetchMock } = await render()
    act(() => button(container, 'Slett').click())
    const dialog = container.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('h2')?.textContent).toBe('Er du sikker på at du vil slette?')
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => button(dialog, 'Avbryt').click())
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe(post.title)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector('output')?.textContent).toBe(`/noticeboard/${post.id}`)
  })

  it.each(['cancel', 'click'])('dismisses via %s without deleting', async (eventType) => {
    const { container, fetchMock } = await render()
    act(() => button(container, 'Slett').click())
    await act(async () => container.querySelector('dialog')!.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true })))
    expect(container.querySelector('dialog')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deletes only after confirmation and returns to Oppslagstavle', async () => {
    const { container, fetchMock } = await render()
    act(() => button(container, 'Slett').click())
    await act(async () => button(container.querySelector('dialog')!, 'Slett').click())
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/.netlify/functions/delete-noticeboard-post?id=${post.id}`, {
      method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
    })
    expect(container.querySelector('output')?.textContent).toBe('/noticeboard')
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('disables confirmation actions and prevents dismissal during deletion', async () => {
    const { container, fetchMock } = await render()
    let resolveDelete: (response: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveDelete = resolve }))
    act(() => button(container, 'Slett').click())
    await act(async () => button(container.querySelector('dialog')!, 'Slett').click())
    const dialog = container.querySelector('dialog')!
    expect(button(dialog, 'Sletter …').disabled).toBe(true)
    expect(button(dialog, 'Avbryt').disabled).toBe(true)
    await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })))
    expect(dialog.open).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => resolveDelete(new Response(null, { status: 204 })))
    expect(container.querySelector('output')?.textContent).toBe('/noticeboard')
  })

  it('keeps the post and confirmation visible when deletion fails', async () => {
    const { container } = await render(500)
    act(() => button(container, 'Slett').click())
    await act(async () => button(container.querySelector('dialog')!, 'Slett').click())
    const dialog = container.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Kunne ikke slette innlegget.')
    expect(button(dialog, 'Slett').disabled).toBe(false)
    expect(container.querySelector('h1')?.textContent).toBe(post.title)
  })

  it('expires an invalid session without navigating away', async () => {
    const { container } = await render(401)
    act(() => button(container, 'Slett').click())
    await act(async () => button(container.querySelector('dialog')!, 'Slett').click())
    expect(auth.expireSession).toHaveBeenCalledOnce()
    expect(container.querySelector('output')?.textContent).toBe(`/noticeboard/${post.id}`)
  })
})
