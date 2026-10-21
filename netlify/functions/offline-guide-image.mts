import { getAuthenticatedFamilyMember } from './_shared/session.mts'
import { loadDriveImageIndex } from './_shared/guide-images.mts'

// Same-origin image download avoids opaque Google Drive responses in browser storage.
export default async function offlineGuideImage(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (request.method !== 'GET') return new Response(null, { status: 405, headers })
  try {
    if (!getAuthenticatedFamilyMember(request)) return new Response(null, { status: 401, headers })
    const id = new URL(request.url).searchParams.get('id')
    const { files } = await loadDriveImageIndex()
    if (!id || !files.some((file) => file.id === id)) return new Response(null, { status: 404, headers })
    const response = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`, {
      signal: AbortSignal.timeout(20_000),
    })
    const type = response.headers.get('Content-Type') ?? ''
    if (!response.ok || !type.startsWith('image/')) return new Response(null, { status: 502, headers })
    return new Response(response.body, { headers: { ...headers, 'Content-Type': type } })
  } catch { return new Response(null, { status: 502, headers }) }
}
