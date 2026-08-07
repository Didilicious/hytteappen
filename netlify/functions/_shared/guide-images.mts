import type { GuideImage } from '../../../shared/guideImages.ts'

export type DriveImageFile = {
  id: string
  name: string
  mimeType: string
}

const driveFolderId = '1yQ3mQ26hyTDNOlXIK-vBXEwC8tNg0Qnc'

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

export function parseDriveFolderHtml(html: string): DriveImageFile[] {
  const entries = html.split('<div class="flip-entry"').slice(1)

  return entries.flatMap((entry) => {
    const id = entry.match(/^ id="entry-([A-Za-z0-9_-]+)"/)?.[1]
    const mimeType = entry.match(/drive-thirdparty\.googleusercontent\.com\/16\/type\/(image\/[^"?]+)/)?.[1]
    const rawName = entry.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/)?.[1]

    if (!id || !mimeType || !rawName) return []

    return [{ id, name: decodeHtml(rawName).trim(), mimeType }]
  })
}

export function sortDriveImages(files: readonly DriveImageFile[]) {
  const collator = new Intl.Collator('nb', { numeric: true, sensitivity: 'base' })
  return [...files].sort((left, right) => collator.compare(left.name, right.name))
}

export function matchDriveImages(files: readonly DriveImageFile[], groups: readonly string[]) {
  const sortedFiles = sortDriveImages(files)

  return Object.fromEntries(groups.map((group) => {
    const prefix = `${group}-`.toLocaleLowerCase('nb')
    const matches: GuideImage[] = sortedFiles
      .filter((file) => file.name.toLocaleLowerCase('nb').startsWith(prefix))
      .map((file) => ({
        name: file.name,
        src: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w1600`,
      }))

    return [group, matches]
  }))
}

export async function fetchDriveImages(fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://drive.google.com/embeddedfolderview?id=${driveFolderId}#list`, {
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) throw new Error('Drive folder request failed')
  return parseDriveFolderHtml(await response.text())
}
