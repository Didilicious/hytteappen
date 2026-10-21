import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// Only build output and explicitly listed public assets belong in the shell cache.
export function appShellPwa(): Plugin {
  return {
    name: 'hytteappen-app-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const hash = createHash('sha256')
        const urls = ['/index.html', '/manifest.webmanifest']
        for (const name of Object.keys(bundle).sort()) {
          const file = bundle[name]
          if (name === 'index.html' || /^assets\/.*\.(js|css|woff2?)$/.test(name)) {
            if (name !== 'index.html') urls.push(`/${name}`)
            hash.update(name).update(file.type === 'chunk' ? file.code : file.source)
          }
        }
        for (const name of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
          hash.update(name).update(readFileSync(new URL(`../public/${name}`, import.meta.url)))
          if (name !== 'manifest.webmanifest') urls.push(`/${name}`)
        }
        const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
        hash.update(template)
        const source = template
          .replace('__SHELL_VERSION__', hash.digest('hex').slice(0, 16))
          .replace('__SHELL_URLS__', JSON.stringify(urls))
        this.emitFile({ type: 'asset', fileName: 'sw.js', source })
      },
    },
  }
}
