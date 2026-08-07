import { describe, expect, it, vi } from 'vitest'
import {
  fetchDriveImages,
  matchDriveImages,
  parseDriveFolderHtml,
  sortDriveImages,
  type DriveImageFile,
} from '../netlify/functions/_shared/guide-images.mts'

function driveEntry(id: string, name: string, mimeType: string) {
  return `<div class="flip-entry" id="entry-${id}">
    <div class="flip-entry-list-icon">
      <img src="https://drive-thirdparty.googleusercontent.com/16/type/${mimeType}" alt=""/>
    </div>
    <div class="flip-entry-title">${name}</div>
  </div>`
}

const files: DriveImageFile[] = [
  { id: 'ten', name: 'test-10.jpg', mimeType: 'image/jpeg' },
  { id: 'other', name: 'annet-1.png', mimeType: 'image/png' },
  { id: 'two', name: 'TEST-2.webp', mimeType: 'image/webp' },
  { id: 'one', name: 'test-1.jpeg', mimeType: 'image/jpeg' },
]

describe('Google Drive guide images', () => {
  it('parses image metadata and ignores unrelated non-image files', () => {
    const html = [
      driveEntry('sheet', 'Guideark', 'application/vnd.google-apps.spreadsheet'),
      driveEntry('image', 'test-1.jpg', 'image/jpeg'),
      driveEntry('png', 'test-2.png', 'image/png'),
    ].join('')

    expect(parseDriveFolderHtml(html)).toEqual([
      { id: 'image', name: 'test-1.jpg', mimeType: 'image/jpeg' },
      { id: 'png', name: 'test-2.png', mimeType: 'image/png' },
    ])
  })

  it('matches groups case-insensitively and ignores unrelated files', () => {
    const result = matchDriveImages(files, ['TeSt'])

    expect(result.TeSt.map((image) => image.name)).toEqual([
      'test-1.jpeg',
      'TEST-2.webp',
      'test-10.jpg',
    ])
    expect(result.TeSt.map((image) => image.name)).not.toContain('annet-1.png')
  })

  it('sorts matching filenames naturally', () => {
    expect(sortDriveImages(files).map((file) => file.name)).toEqual([
      'annet-1.png',
      'test-1.jpeg',
      'TEST-2.webp',
      'test-10.jpg',
    ])
  })

  it('returns an empty list when a group has no matching image', () => {
    expect(matchDriveImages(files, ['mangler'])).toEqual({ mangler: [] })
  })

  it('returns browser-loaded Drive thumbnail URLs without downloading images', () => {
    const result = matchDriveImages(files, ['test'])

    expect(result.test[0]).toEqual({
      name: 'test-1.jpeg',
      src: 'https://drive.google.com/thumbnail?id=one&sz=w1600',
    })
  })

  it('rejects when the Drive folder request fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))

    await expect(fetchDriveImages(fetcher)).rejects.toThrow('Drive folder request failed')
  })
})
