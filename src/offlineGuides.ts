import { useSyncExternalStore } from 'react'
import type { GuideContent } from '../shared/guideContent'
import type { GuideImage } from '../shared/guideImages'
import { readContentResponse } from './guideContent'
import { collectImageGroups, readImagesResponse } from './guideImages'

export type OfflineBundle = {
  content: GuideContent[]
  imagesByGroup: Record<string, GuideImage[]>
  blobs: Record<string, Blob>
  updatedAt: string
  bytes: number
}

function subscribeNetwork(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
export function useOnline() {
  return useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true)
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('hytteappen-offline-guides', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('guides')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Storage blocked'))
  })
}

export async function readOfflineGuides(): Promise<OfflineBundle | undefined> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('guides').objectStore('guides').get('current')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function writeBundle(bundle?: OfflineBundle) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      // A single transaction keeps the previous complete download on quota/write failure.
      const transaction = db.transaction('guides', 'readwrite')
      const store = transaction.objectStore('guides')
      if (bundle) store.put(bundle, 'current')
      else store.delete('current')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally { db.close() }
}

const objectUrls = new Map<string, string>()
function clearImageUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
  objectUrls.clear()
}
export async function deleteOfflineGuides() {
  await writeBundle()
  clearImageUrls()
}
export async function offlineImages() {
  const bundle = await readOfflineGuides()
  if (!bundle) throw new Error('Offline images unavailable')
  return Object.fromEntries(Object.entries(bundle.imagesByGroup).map(([group, images]) => [group,
    images.map((image) => {
      const blob = bundle.blobs[image.src]
      if (!blob) throw new Error('Offline image missing')
      let src = objectUrls.get(image.src)
      if (!src) {
        src = URL.createObjectURL(blob)
        objectUrls.set(image.src, src)
      }
      return { ...image, src }
    }),
  ]))
}

async function requestJson(path: string) {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error('Download failed')
  return response.json()
}

export async function downloadOfflineGuides(progress: (label: string, completed: number, total: number) => void) {
  progress('Henter guideinnhold …', 0, 1)
  const content = readContentResponse(await requestJson('/.netlify/functions/guide-content'))
  if (!content) {
    throw new Error('Invalid guide content')
  }
  const groups = collectImageGroups(content)
  const params = new URLSearchParams()
  groups.forEach((group) => params.append('group', group))
  const imagesByGroup = groups.length ? readImagesResponse(await requestJson(`/.netlify/functions/guide-images?${params}`), groups) : {}
  if (!imagesByGroup) throw new Error('Invalid images')
  const sources = [...new Set(Object.values(imagesByGroup).flat().map((image) => image.src))]
  const blobs: Record<string, Blob> = {}
  let bytes = new Blob([JSON.stringify({ content, imagesByGroup })]).size
  for (const [index, src] of sources.entries()) {
    progress(`Laster ned bilder (${index + 1} av ${sources.length}) …`, index + 1, sources.length + 2)
    const id = new URL(src).searchParams.get('id')
    if (!id) throw new Error('Invalid image URL')
    const response = await fetch(`/.netlify/functions/offline-guide-image?id=${encodeURIComponent(id)}`, {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error('Image download failed')
    const blob = await response.blob()
    if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Invalid image')
    blobs[src] = blob
    bytes += blob.size
  }
  progress('Lagrer guider på enheten …', sources.length + 1, sources.length + 2)
  const bundle: OfflineBundle = { content, imagesByGroup, blobs, bytes, updatedAt: new Date().toISOString() }
  await writeBundle(bundle)
  clearImageUrls()
  // Browsers may decline this request; IndexedDB still persists between visits.
  try { await navigator.storage?.persist?.() } catch { /* Download remains usable. */ }
  progress('Alle fire guider er tilgjengelige offline.', 1, 1)
  return bundle
}
