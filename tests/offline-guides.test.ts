import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteOfflineGuides, downloadOfflineGuides, offlineImages, readOfflineGuides } from '../src/offlineGuides'
import { loadGuideContent } from '../src/guideContent'
import { loadGuideImages } from '../src/guideImages'
import { buildVisiblePages } from '../src/guideEngine'
import { guides } from '../src/guideData'
import { searchDriftPages } from '../src/driftReference'
import type { GuideContent } from '../shared/guideContent'

const page: GuideContent = {
  id: 'water', title: 'Vannpumpe', guides: ['Åpne', 'Stenge', 'Drift', 'Feilsøking'], type: 'question',
  afterId: null, requiredStepIds: [], answerRequirements: [], location: null, warning: null,
  instructions: ['Kontroller pumpen'], checkpoints: null, answerOptions: ['Ja', 'Nei'], canSkip: false, imageGroup: 'water',
}
const branch: GuideContent = { ...page, id: 'check', type: 'step', afterId: 'water', answerOptions: [], answerRequirements: [{ questionId: 'water', answer: 'Ja' }] }

function mockDownload(title = page.title) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('guide-content')) return Response.json({ content: [{ ...page, title }, branch] })
    if (url.includes('guide-images')) return Response.json({ imagesByGroup: { water: [{ name: 'water-1.jpg', src: 'https://drive.google.com/thumbnail?id=public-image&sz=w1600' }] } })
    return new Response(new Blob(['image bytes'], { type: 'image/jpeg' }))
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true, storage: { persist: vi.fn(async () => true) } })
  await deleteOfflineGuides()
})
afterEach(() => vi.unstubAllGlobals())

describe('explicit offline guide downloads', () => {
  it('stores a complete snapshot, uses it without network, and retains branching and search', async () => {
    const fetcher = mockDownload()
    const progress = vi.fn()
    const saved = await downloadOfflineGuides(progress)
    expect(saved.bytes).toBeGreaterThan(0)
    expect(saved.blobs[Object.keys(saved.blobs)[0]].size).toBeGreaterThan(0)
    expect(progress).toHaveBeenLastCalledWith('Alle fire guider er tilgjengelige offline.', 1, 1)
    vi.stubGlobal('navigator', { onLine: false })
    fetcher.mockClear()
    const content = await loadGuideContent()
    expect(buildVisiblePages(guides['open-cabin'], content, { water: 'Ja' }, {}).map((item) => item.id)).toContain('check')
    expect(buildVisiblePages(guides['open-cabin'], content, { water: 'Nei' }, {}).map((item) => item.id)).not.toContain('check')
    expect(searchDriftPages(content, 'pumpe')).toHaveLength(2)
    const images = await loadGuideImages(content)
    expect(images.water[0].src).toMatch(/^blob:/)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps the working snapshot after image, content, or storage failures', async () => {
    mockDownload()
    const original = await downloadOfflineGuides(vi.fn())
    const fetcher = mockDownload('Ny versjon')
    fetcher.mockImplementation(async (url) => {
      if (url.includes('offline-guide-image')) return new Response(null, { status: 502 })
      if (url.includes('guide-content')) return Response.json({ content: [{ ...page, title: 'Ny versjon' }, branch] })
      return Response.json({ imagesByGroup: { water: [{ name: 'water-1.jpg', src: 'https://drive.google.com/thumbnail?id=public-image' }] } })
    })
    await expect(downloadOfflineGuides(vi.fn())).rejects.toThrow()
    expect((await readOfflineGuides())?.updatedAt).toBe(original.updatedAt)
    fetcher.mockResolvedValue(Response.json({ content: null }))
    await expect(downloadOfflineGuides(vi.fn())).rejects.toThrow()
    expect((await readOfflineGuides())?.content[0].title).toBe(page.title)
    mockDownload('Ny versjon')
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await expect(downloadOfflineGuides(vi.fn())).rejects.toThrow()
    put.mockRestore()
    expect((await readOfflineGuides())?.content[0].title).toBe(page.title)
  })

  it('replaces only complete downloads and deletes persisted content', async () => {
    mockDownload()
    await downloadOfflineGuides(vi.fn())
    mockDownload('Oppdatert vannpumpe')
    await downloadOfflineGuides(vi.fn())
    expect((await readOfflineGuides())?.content[0].title).toBe('Oppdatert vannpumpe')
    await deleteOfflineGuides()
    expect(await readOfflineGuides()).toBeUndefined()
    await expect(offlineImages()).rejects.toThrow()
    vi.stubGlobal('navigator', { onLine: false })
    await expect(loadGuideContent()).rejects.toThrow()
  })

  it('downloads existing content and images when Feilsøking has no published pages', async () => {
    const fetcher = mockDownload()
    fetcher.mockImplementation(async (url) => {
      if (url.includes('guide-content')) return Response.json({ content: [{ ...page, guides: ['Åpne', 'Stenge', 'Drift'] }] })
      if (url.includes('guide-images')) return Response.json({ imagesByGroup: { water: [{ name: 'water-1.jpg', src: 'https://drive.google.com/thumbnail?id=public-image' }] } })
      return new Response(new Blob(['image bytes'], { type: 'image/jpeg' }))
    })
    await downloadOfflineGuides(vi.fn())
    vi.stubGlobal('navigator', { onLine: false })
    fetcher.mockClear()
    const content = await loadGuideContent()
    expect(content).toHaveLength(1)
    expect(buildVisiblePages(guides.troubleshooting, content, {}, {})).toEqual([])
    expect(buildVisiblePages(guides['open-cabin'], content, {}, {})).toHaveLength(1)
    expect((await loadGuideImages(content)).water[0].src).toMatch(/^blob:/)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('accepts an empty published sheet and includes newly published content on update', async () => {
    const fetcher = vi.fn(async () => Response.json({ content: [] }))
    vi.stubGlobal('fetch', fetcher)
    const saved = await downloadOfflineGuides(vi.fn())
    expect(saved.content).toEqual([])
    expect(saved.imagesByGroup).toEqual({})
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.stubGlobal('navigator', { onLine: false })
    expect(await loadGuideContent()).toEqual([])
    expect(await loadGuideImages([])).toEqual({})

    vi.stubGlobal('navigator', { onLine: true })
    mockDownload()
    await downloadOfflineGuides(vi.fn())
    expect((await readOfflineGuides())?.content.some((item) => item.guides.includes('Feilsøking'))).toBe(true)
  })
})
