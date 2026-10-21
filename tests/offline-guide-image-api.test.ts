import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../netlify/functions/_shared/session.mts', () => ({ getAuthenticatedFamilyMember: vi.fn() }))
vi.mock('../netlify/functions/_shared/guide-images.mts', () => ({ loadDriveImageIndex: vi.fn() }))
import handler from '../netlify/functions/offline-guide-image.mts'
import { getAuthenticatedFamilyMember } from '../netlify/functions/_shared/session.mts'
import { loadDriveImageIndex } from '../netlify/functions/_shared/guide-images.mts'

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })
describe('offline guide image download boundary', () => {
  it('requires a valid session and does not fetch an arbitrary Drive ID', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    vi.mocked(getAuthenticatedFamilyMember).mockReturnValue(null)
    expect((await handler(new Request('https://app.test/?id=private'))).status).toBe(401)
    vi.mocked(getAuthenticatedFamilyMember).mockReturnValue({ id: 'member' } as never)
    vi.mocked(loadDriveImageIndex).mockResolvedValue({ files: [], conflicts: [] })
    expect((await handler(new Request('https://app.test/?id=private'))).status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('streams only published folder images without HTTP caching', async () => {
    vi.mocked(getAuthenticatedFamilyMember).mockReturnValue({ id: 'member' } as never)
    vi.mocked(loadDriveImageIndex).mockResolvedValue({ files: [{ id: 'allowed', name: 'image.jpg', mimeType: 'image/jpeg' }], conflicts: [] })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bytes', { headers: { 'Content-Type': 'image/jpeg' } })))
    const response = await handler(new Request('https://app.test/?id=allowed'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(await response.text()).toBe('bytes')
  })
})
