import type { GuideImage } from '../../../shared/guideImages.ts'

export type DriveImageFile = {
  id: string
  name: string
  mimeType: string
  /** Path relative to the configured root folder, including the filename. Used for warnings only. */
  path?: string
}

export type DriveImageConflict = {
  /** Lower-cased filename without extension, the key two or more files fight over. */
  baseName: string
  paths: string[]
}

export type DriveImageIndex = {
  /** Unambiguous image files from the whole folder tree, naturally sorted by filename. */
  files: DriveImageFile[]
  conflicts: DriveImageConflict[]
}

type DriveEntry = {
  id: string
  name: string
  mimeType: string
}

type DriveFolderRef = {
  id: string
  path: string
}

const driveFolderId = '1yQ3mQ26hyTDNOlXIK-vBXEwC8tNg0Qnc'
const folderMimeType = 'application/vnd.google-apps.folder'
const maxFolderDepth = 8
const maxFolderRequests = 60
const indexCacheDurationMs = 60_000

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

function parseDriveEntries(html: string): DriveEntry[] {
  const entries = html.split('<div class="flip-entry"').slice(1)

  return entries.flatMap((entry) => {
    const id = entry.match(/^ id="entry-([A-Za-z0-9_-]+)"/)?.[1]
    const mimeType = entry
      .match(/drive-thirdparty\.googleusercontent\.com\/16\/type\/([\w.+-]+\/[\w.+-]+)/)?.[1]
    const rawName = entry.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/)?.[1]

    if (!id || !mimeType || !rawName) return []

    return [{ id, name: decodeHtml(rawName).trim(), mimeType }]
  })
}

function joinDrivePath(folderPath: string, name: string) {
  return folderPath ? `${folderPath}/${name}` : name
}

export function parseDriveFolderContents(html: string, folderPath = '') {
  const entries = parseDriveEntries(html)

  const files: DriveImageFile[] = entries
    .filter((entry) => entry.mimeType.startsWith('image/'))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      mimeType: entry.mimeType,
      path: joinDrivePath(folderPath, entry.name),
    }))
  const folders: DriveFolderRef[] = entries
    .filter((entry) => entry.mimeType === folderMimeType)
    .map((entry) => ({ id: entry.id, path: joinDrivePath(folderPath, entry.name) }))

  return { files, folders }
}

export function parseDriveFolderHtml(html: string, folderPath = ''): DriveImageFile[] {
  return parseDriveFolderContents(html, folderPath).files
}

export function parseDriveFolderLinks(html: string, folderPath = ''): DriveFolderRef[] {
  return parseDriveFolderContents(html, folderPath).folders
}

function createCollator() {
  return new Intl.Collator('nb', { numeric: true, sensitivity: 'base' })
}

export function sortDriveImages(files: readonly DriveImageFile[]) {
  const collator = createCollator()
  return [...files].sort((left, right) => collator.compare(left.name, right.name))
}

function toGuideImage(file: DriveImageFile): GuideImage {
  return {
    name: file.name,
    src: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w1600`,
  }
}

export function matchDriveImages(files: readonly DriveImageFile[], groups: readonly string[]) {
  const sortedFiles = sortDriveImages(files)

  return Object.fromEntries(groups.map((group) => {
    const prefix = `${group}-`.toLocaleLowerCase('nb')
    const matches: GuideImage[] = sortedFiles
      .filter((file) => file.name.toLocaleLowerCase('nb').startsWith(prefix))
      .map(toGuideImage)

    return [group, matches]
  }))
}

function getSupportedImageBaseName(filename: string) {
  return filename.match(/^(.*)\.(?:png|jpe?g|webp)$/i)?.[1]
}

export function matchDriveIcons(files: readonly DriveImageFile[], iconNames: readonly string[]) {
  const sortedFiles = sortDriveImages(files)

  return Object.fromEntries(iconNames.map((iconName) => {
    const normalizedIconName = iconName.toLocaleLowerCase('nb')
    const match = sortedFiles.find((file) => (
      getSupportedImageBaseName(file.name)?.toLocaleLowerCase('nb') === normalizedIconName
    ))

    return [iconName, match ? toGuideImage(match) : null]
  }))
}

/**
 * The matching key is derived from the filename only, so the folder a file lives in never
 * influences whether it matches a Bildegruppe or an icon name.
 */
function getImageMatchKey(filename: string) {
  return filename.replace(/\.[^.]+$/, '').toLocaleLowerCase('nb')
}

export function buildDriveImageIndex(files: readonly DriveImageFile[]): DriveImageIndex {
  const filesByKey = new Map<string, DriveImageFile[]>()

  for (const file of files) {
    const key = getImageMatchKey(file.name)
    const existing = filesByKey.get(key)
    if (existing) existing.push(file)
    else filesByKey.set(key, [file])
  }

  const collator = createCollator()
  const unambiguousFiles: DriveImageFile[] = []
  const conflicts: DriveImageConflict[] = []

  for (const [baseName, candidates] of filesByKey) {
    if (candidates.length === 1) {
      unambiguousFiles.push(candidates[0])
      continue
    }

    conflicts.push({
      baseName,
      paths: candidates
        .map((candidate) => candidate.path ?? candidate.name)
        .sort((left, right) => collator.compare(left, right)),
    })
  }

  return {
    files: sortDriveImages(unambiguousFiles),
    conflicts: conflicts.sort((left, right) => collator.compare(left.baseName, right.baseName)),
  }
}

export function formatDriveImageConflictWarning(conflict: DriveImageConflict) {
  return `Google Drive image "${conflict.baseName}" exists in more than one place `
    + `(${conflict.paths.join(', ')}). Excluding it from image matching until the duplicate is removed.`
}

async function fetchDriveFolderEntries(folderId: string, fetcher: typeof fetch) {
  const response = await fetcher(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`,
    {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(8_000),
    },
  )

  if (!response.ok) throw new Error('Drive folder request failed')
  return response.text()
}

type FetchDriveImagesOptions = {
  rootFolderId?: string
  warn?: (message: string) => void
}

/**
 * Walks the configured root folder and every nested subfolder breadth first. One request per
 * folder is unavoidable with the embedded folder view, so folders on the same level are fetched
 * concurrently and the resulting index is cached by `loadDriveImageIndex`.
 */
export async function fetchDriveImages(
  fetcher: typeof fetch = fetch,
  { rootFolderId = driveFolderId, warn = defaultWarn }: FetchDriveImagesOptions = {},
) {
  const files: DriveImageFile[] = []
  const seenFileIds = new Set<string>()
  const visitedFolderIds = new Set<string>([rootFolderId])
  let currentLevel: DriveFolderRef[] = [{ id: rootFolderId, path: '' }]
  let requestCount = 0
  let depth = 0

  while (currentLevel.length > 0) {
    const allowedRequests = Math.max(0, maxFolderRequests - requestCount)
    const folders = currentLevel.slice(0, allowedRequests)

    if (folders.length < currentLevel.length) {
      warn(
        `Google Drive folder traversal stopped after ${maxFolderRequests} folder requests. `
        + `${currentLevel.length - folders.length} folder(s) were not read.`,
      )
    }

    requestCount += folders.length

    const levelEntries = await Promise.all(folders.map(async (folder) => ({
      folder,
      html: await fetchDriveFolderEntries(folder.id, fetcher),
    })))

    const nextLevel: DriveFolderRef[] = []

    for (const { folder, html } of levelEntries) {
      const contents = parseDriveFolderContents(html, folder.path)

      for (const file of contents.files) {
        if (seenFileIds.has(file.id)) continue
        seenFileIds.add(file.id)
        files.push(file)
      }

      for (const subfolder of contents.folders) {
        if (visitedFolderIds.has(subfolder.id)) continue
        visitedFolderIds.add(subfolder.id)
        nextLevel.push(subfolder)
      }
    }

    if (nextLevel.length > 0 && depth >= maxFolderDepth) {
      warn(
        `Google Drive folder traversal stopped at depth ${maxFolderDepth}. Images below `
        + `${nextLevel.map((folder) => folder.path).join(', ')} were not read.`,
      )
      currentLevel = []
    } else {
      currentLevel = nextLevel
    }
    depth += 1
  }

  return files
}

function defaultWarn(message: string) {
  console.warn(message)
}

type LoadDriveImageIndexOptions = FetchDriveImagesOptions & {
  fetcher?: typeof fetch
}

let cachedIndex: { index: DriveImageIndex; expiresAt: number } | undefined
let pendingIndex: Promise<DriveImageIndex> | undefined

export function clearDriveImageIndexCache() {
  cachedIndex = undefined
  pendingIndex = undefined
}

/**
 * Returns the normalized recursive file index. The index is cached in the function instance for a
 * short window so a guide page or an icon row does not re-traverse Drive per request, while newly
 * added, moved or removed images still appear without a redeploy. Concurrent callers share one
 * traversal.
 */
export function loadDriveImageIndex({ fetcher = fetch, warn = defaultWarn, rootFolderId }: LoadDriveImageIndexOptions = {}) {
  if (cachedIndex && cachedIndex.expiresAt > Date.now()) {
    return Promise.resolve(cachedIndex.index)
  }

  if (!pendingIndex) {
    pendingIndex = fetchDriveImages(fetcher, { rootFolderId, warn })
      .then((files) => {
        const index = buildDriveImageIndex(files)
        cachedIndex = { index, expiresAt: Date.now() + indexCacheDurationMs }

        for (const conflict of index.conflicts) {
          warn(formatDriveImageConflictWarning(conflict))
        }

        return index
      })
      .finally(() => {
        pendingIndex = undefined
      })
  }

  return pendingIndex
}
