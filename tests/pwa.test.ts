import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { appShellPwa } from '../pwa/plugin'

const shellUrls = ['/index.html', '/assets/app-123.js', '/assets/app-123.css', '/manifest.webmanifest']

function worker() {
  const listeners: Record<string, (event: any) => void> = {}
  const match = vi.fn(async () => 'cached shell')
  const addAll = vi.fn(async () => {})
  const cache = { match, addAll }
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ['hytteappen-shell-old', 'unrelated-cache']), delete: vi.fn() }
  const self = { location: { origin: 'https://hytteappen.test' }, addEventListener: (name: string, callback: (event: any) => void) => { listeners[name] = callback }, skipWaiting: vi.fn() }
  const fetch = vi.fn().mockRejectedValue(new TypeError('Offline'))
  const requests: Array<{ url: string; options: unknown }> = []
  runInNewContext(readFileSync(new URL('../pwa/service-worker.js', import.meta.url), 'utf8')
    .replace('__SHELL_VERSION__', 'test')
    .replace('__SHELL_URLS__', JSON.stringify(shellUrls)), {
    self, caches, fetch, URL, Set,
    Request: class { constructor(url: string, options: unknown) { requests.push({ url, options }) } },
  })
  return { listeners, cache, caches, self, fetch, requests }
}

describe('PWA shell privacy and lifecycle', () => {
  it.each([
    ['/.netlify/functions/read-booking', 'GET', 'cors'],
    ['/.netlify/functions/session', 'GET', 'navigate'],
    ['/api/profiles', 'GET', 'navigate'],
    ['/profile-images/photo.png', 'GET', 'cors'],
    ['/assets/app-123.js?personal=true', 'GET', 'cors'],
    ['/booking', 'POST', 'navigate'],
    ['https://sheets.googleapis.com/private', 'GET', 'cors'],
  ])('does not intercept %s (%s, %s)', (path, method, mode) => {
    const { listeners } = worker()
    const respondWith = vi.fn()
    listeners.fetch({ request: { url: new URL(path, 'https://hytteappen.test').href, method, mode }, respondWith })
    expect(respondWith).not.toHaveBeenCalled()
  })

  it.each(['/booking/event/123', '/guide/open/start', '/offline-innhold', '/login', '/familieoversikt/123', '/noticeboard/42'])('falls back to only the static HTML when offline at %s', async (path) => {
    const { listeners, cache, fetch } = worker()
    const respondWith = vi.fn()
    listeners.fetch({ request: { url: `https://hytteappen.test${path}`, method: 'GET', mode: 'navigate' }, respondWith })
    expect(await respondWith.mock.calls[0][0]).toBe('cached shell')
    expect(cache.match).toHaveBeenCalledWith('/index.html')
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ mode: 'navigate' }), { cache: 'no-store' })
  })

  it('loads current HTML from the network even when an older shell is cached', async () => {
    const { listeners, cache, fetch } = worker()
    const latest = { ok: true, body: 'latest deployment' }
    fetch.mockResolvedValue(latest)
    const respondWith = vi.fn()
    const request = { url: 'https://hytteappen.test/guide/open-cabin', method: 'GET', mode: 'navigate' }
    listeners.fetch({ request, respondWith })
    expect(await respondWith.mock.calls[0][0]).toBe(latest)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(request, { cache: 'no-store' })
    expect(cache.match).not.toHaveBeenCalled()
  })

  it('uses the offline shell if the server returns an error', async () => {
    const { listeners, fetch } = worker()
    fetch.mockResolvedValue({ ok: false, status: 503 })
    const respondWith = vi.fn()
    listeners.fetch({ request: { url: 'https://hytteappen.test/', method: 'GET', mode: 'navigate' }, respondWith })
    expect(await respondWith.mock.calls[0][0]).toBe('cached shell')
  })

  it('installs only explicit shell URLs without credentials and waits for user approval', async () => {
    const { listeners, requests, self } = worker()
    const waitUntil = vi.fn()
    listeners.install({ waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(requests.map((request) => request.url)).toEqual(shellUrls)
    expect(requests.every((request) => JSON.stringify(request.options) === JSON.stringify({ cache: 'reload', credentials: 'omit' }))).toBe(true)
    expect(self.skipWaiting).not.toHaveBeenCalled()
    listeners.message({ data: { type: 'SKIP_WAITING' } })
    expect(self.skipWaiting).toHaveBeenCalledOnce()
  })

  it('deletes only obsolete app shell caches', async () => {
    const { listeners, caches } = worker()
    const waitUntil = vi.fn()
    listeners.activate({ waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(caches.delete).toHaveBeenCalledExactlyOnceWith('hytteappen-shell-old')
  })
})

describe('PWA deployment output', () => {
  it('generates a versioned worker from production bundle assets only', () => {
    const plugin = appShellPwa()
    const hook = plugin.generateBundle as { handler: Function }
    const emitFile = vi.fn()
    const bundle = {
      'index.html': { type: 'asset', source: '<html></html>' },
      'assets/app-123.js': { type: 'chunk', code: 'app()' },
      'assets/app-123.css': { type: 'asset', source: 'body {}' },
      'assets/personal.json': { type: 'asset', source: '{}' },
    }
    hook.handler.call({ emitFile }, {}, bundle)
    const first = emitFile.mock.calls[0][0]
    expect(first.fileName).toBe('sw.js')
    expect(first.source).not.toMatch(/__SHELL_/)
    expect(first.source).toContain('/assets/app-123.js')
    expect(first.source).not.toContain('/assets/personal.json')
    bundle['assets/app-123.js'].code = 'changed()'
    hook.handler.call({ emitFile }, {}, bundle)
    expect(emitFile.mock.calls[1][0].source).not.toBe(first.source)
  })

  it('declares standalone installation and valid Android and iOS icons', async () => {
    const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
    expect(manifest).toMatchObject({ name: 'Hytteappen', display: 'standalone', start_url: '/', scope: '/' })
    for (const icon of manifest.icons) {
      const metadata = await sharp(new URL(`../public${icon.src}`, import.meta.url).pathname).metadata()
      expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes)
      expect(metadata.format).toBe('png')
      expect(metadata.hasAlpha).toBe(false)
    }
    const apple = await sharp(new URL('../public/icons/apple-touch-icon.png', import.meta.url).pathname).metadata()
    expect([apple.width, apple.height]).toEqual([180, 180])
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('rel="apple-touch-icon"')
  })
})
