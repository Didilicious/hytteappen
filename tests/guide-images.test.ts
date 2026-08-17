import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildDriveImageIndex,
  clearDriveImageIndexCache,
  fetchDriveImages,
  loadDriveImageIndex,
  matchDriveIcons,
  matchDriveImages,
  parseDriveFolderHtml,
  parseDriveFolderLinks,
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

function folderEntry(id: string, name: string) {
  return driveEntry(id, name, 'application/vnd.google-apps.folder')
}

/** Builds a fetcher that serves one embedded folder view per folder id. */
function driveFetcher(foldersById: Record<string, string>) {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const folderId = new URL(String(input)).searchParams.get('id') ?? ''
    const html = foldersById[folderId]
    if (html === undefined) return new Response('', { status: 404 })
    return new Response(html)
  })
}

const files: DriveImageFile[] = [
  { id: 'ten', name: 'test-10.jpg', mimeType: 'image/jpeg' },
  { id: 'other', name: 'annet-1.png', mimeType: 'image/png' },
  { id: 'two', name: 'TEST-2.webp', mimeType: 'image/webp' },
  { id: 'one', name: 'test-1.jpeg', mimeType: 'image/jpeg' },
]

describe('Google Drive guide images', () => {
  afterEach(() => {
    clearDriveImageIndexCache()
    vi.restoreAllMocks()
  })

  it('parses image metadata and ignores unrelated non-image files', () => {
    const html = [
      driveEntry('sheet', 'Guideark', 'application/vnd.google-apps.spreadsheet'),
      driveEntry('image', 'test-1.jpg', 'image/jpeg'),
      driveEntry('png', 'test-2.png', 'image/png'),
    ].join('')

    expect(parseDriveFolderHtml(html)).toEqual([
      { id: 'image', name: 'test-1.jpg', mimeType: 'image/jpeg', path: 'test-1.jpg' },
      { id: 'png', name: 'test-2.png', mimeType: 'image/png', path: 'test-2.png' },
    ])
  })

  it('parses subfolder links and prefixes them with the parent folder path', () => {
    const html = [
      folderEntry('images', 'Guidebilder'),
      driveEntry('doc', 'Notater', 'application/vnd.google-apps.document'),
      driveEntry('image', 'test-1.jpg', 'image/jpeg'),
    ].join('')

    expect(parseDriveFolderLinks(html, 'Guidebilder')).toEqual([
      { id: 'images', path: 'Guidebilder/Guidebilder' },
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

  it('matches requested icon names by exact base filename across supported extensions', () => {
    const iconFiles: DriveImageFile[] = [
      { id: 'cabin', name: 'icon_cabin.png', mimeType: 'image/png' },
      { id: 'open', name: 'icon_cabin_open.JPG', mimeType: 'image/jpeg' },
      { id: 'calendar', name: 'icon_calendar.jpeg', mimeType: 'image/jpeg' },
      { id: 'calendar-booking', name: 'icon_calendar_booking.PNG', mimeType: 'image/png' },
      { id: 'calendar-new', name: 'icon_calendar_new.jpg', mimeType: 'image/jpeg' },
      { id: 'calendar-edit', name: 'icon_calendar_edit.webp', mimeType: 'image/webp' },
      { id: 'food', name: 'icon_food.webp', mimeType: 'image/webp' },
    ]

    expect(matchDriveIcons(iconFiles, [
      'icon_cabin_open',
      'icon_calendar',
      'icon_calendar_booking',
      'icon_calendar_new',
      'icon_calendar_edit',
      'icon_food',
    ])).toEqual({
      icon_cabin_open: {
        name: 'icon_cabin_open.JPG',
        src: 'https://drive.google.com/thumbnail?id=open&sz=w1600',
      },
      icon_calendar: {
        name: 'icon_calendar.jpeg',
        src: 'https://drive.google.com/thumbnail?id=calendar&sz=w1600',
      },
      icon_calendar_booking: {
        name: 'icon_calendar_booking.PNG',
        src: 'https://drive.google.com/thumbnail?id=calendar-booking&sz=w1600',
      },
      icon_calendar_new: {
        name: 'icon_calendar_new.jpg',
        src: 'https://drive.google.com/thumbnail?id=calendar-new&sz=w1600',
      },
      icon_calendar_edit: {
        name: 'icon_calendar_edit.webp',
        src: 'https://drive.google.com/thumbnail?id=calendar-edit&sz=w1600',
      },
      icon_food: {
        name: 'icon_food.webp',
        src: 'https://drive.google.com/thumbnail?id=food&sz=w1600',
      },
    })
  })

  it('does not let icon_cabin match icon_cabin_open or unsupported extensions', () => {
    const iconFiles: DriveImageFile[] = [
      { id: 'open', name: 'icon_cabin_open.png', mimeType: 'image/png' },
      { id: 'gif', name: 'icon_cabin.gif', mimeType: 'image/gif' },
    ]

    expect(matchDriveIcons(iconFiles, ['icon_cabin'])).toEqual({ icon_cabin: null })
  })

  it('rejects when the Drive folder request fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))

    await expect(fetchDriveImages(fetcher)).rejects.toThrow('Drive folder request failed')
  })
})

describe('Recursive Google Drive discovery', () => {
  afterEach(() => {
    clearDriveImageIndexCache()
    vi.restoreAllMocks()
  })

  const nestedFolders = {
    root: [
      driveEntry('icon', 'icon_calendar.png', 'image/png'),
      driveEntry('sheet', 'Guideark', 'application/vnd.google-apps.spreadsheet'),
      folderEntry('guide-images', 'Guidebilder'),
      folderEntry('documents', 'Dokumenter'),
    ].join(''),
    'guide-images': [
      driveEntry('code-box', 'kodeboks-1.jpg', 'image/jpeg'),
      folderEntry('water', 'Vann'),
    ].join(''),
    water: [
      driveEntry('main-valve', 'hovedkran-1.jpg', 'image/jpeg'),
      driveEntry('main-valve-two', 'hovedkran-2.png', 'image/png'),
    ].join(''),
    documents: driveEntry('pdf', 'Manual.pdf', 'application/pdf'),
  }

  it('discovers images in the root folder, one level deep and several levels deep', async () => {
    const fetcher = driveFetcher(nestedFolders)

    const discovered = await fetchDriveImages(fetcher, { rootFolderId: 'root' })

    expect(discovered.map((file) => file.path).sort()).toEqual([
      'Guidebilder/Vann/hovedkran-1.jpg',
      'Guidebilder/Vann/hovedkran-2.png',
      'Guidebilder/kodeboks-1.jpg',
      'icon_calendar.png',
    ])
  })

  it('ignores unrelated files and keeps folder names out of the matching key', async () => {
    const fetcher = driveFetcher(nestedFolders)

    const { files: indexedFiles, conflicts } = buildDriveImageIndex(
      await fetchDriveImages(fetcher, { rootFolderId: 'root' }),
    )

    expect(conflicts).toEqual([])
    expect(indexedFiles.map((file) => file.name)).not.toContain('Manual.pdf')
    expect(indexedFiles.map((file) => file.name)).not.toContain('Guideark')
    expect(matchDriveImages(indexedFiles, ['hovedkran']).hovedkran.map((image) => image.name)).toEqual([
      'hovedkran-1.jpg',
      'hovedkran-2.png',
    ])
    expect(matchDriveImages(indexedFiles, ['Vann']).Vann).toEqual([])
    expect(matchDriveImages(indexedFiles, ['Guidebilder']).Guidebilder).toEqual([])
  })

  it('matches a Bildegruppe the same way regardless of which folder the image lives in', async () => {
    const flat = {
      root: [
        driveEntry('one', 'kodeboks-1.jpg', 'image/jpeg'),
        driveEntry('two', 'kodeboks-2.jpg', 'image/jpeg'),
      ].join(''),
    }
    const nested = {
      root: folderEntry('deep-one', 'Guidebilder'),
      'deep-one': folderEntry('deep-two', 'Nøkkelboks'),
      'deep-two': [
        driveEntry('one', 'kodeboks-1.jpg', 'image/jpeg'),
        driveEntry('two', 'kodeboks-2.jpg', 'image/jpeg'),
      ].join(''),
    }

    const flatIndex = buildDriveImageIndex(await fetchDriveImages(driveFetcher(flat), { rootFolderId: 'root' }))
    const nestedIndex = buildDriveImageIndex(await fetchDriveImages(driveFetcher(nested), { rootFolderId: 'root' }))

    expect(matchDriveImages(nestedIndex.files, ['kodeboks']))
      .toEqual(matchDriveImages(flatIndex.files, ['kodeboks']))
  })

  it('matches icons stored several subfolders deep', async () => {
    const fetcher = driveFetcher({
      root: folderEntry('icons', 'Ikoner'),
      icons: folderEntry('booking-icons', 'Booking'),
      'booking-icons': driveEntry('booking', 'icon_calendar_booking.png', 'image/png'),
    })

    const { files: indexedFiles } = buildDriveImageIndex(
      await fetchDriveImages(fetcher, { rootFolderId: 'root' }),
    )

    expect(matchDriveIcons(indexedFiles, ['icon_calendar_booking'])).toEqual({
      icon_calendar_booking: {
        name: 'icon_calendar_booking.png',
        src: 'https://drive.google.com/thumbnail?id=booking&sz=w1600',
      },
    })
  })

  it('does not request the same folder twice when a folder is linked from two places', async () => {
    const fetcher = driveFetcher({
      root: [folderEntry('shared', 'Guidebilder'), folderEntry('archive', 'Arkiv')].join(''),
      archive: folderEntry('shared', 'Guidebilder'),
      shared: driveEntry('one', 'kodeboks-1.jpg', 'image/jpeg'),
    })

    const discovered = await fetchDriveImages(fetcher, { rootFolderId: 'root' })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(discovered.map((file) => file.path)).toEqual(['Guidebilder/kodeboks-1.jpg'])
  })

  it('treats the same filename in two folders as a conflict instead of picking one', async () => {
    const warn = vi.fn()
    const fetcher = driveFetcher({
      root: [folderEntry('guide-images', 'Guidebilder'), folderEntry('archive', 'Arkiv')].join(''),
      'guide-images': [
        driveEntry('code-box', 'kodeboks-1.jpg', 'image/jpeg'),
        driveEntry('code-box-two', 'kodeboks-2.jpg', 'image/jpeg'),
      ].join(''),
      archive: [
        driveEntry('old-code-box', 'kodeboks-1.jpg', 'image/jpeg'),
        driveEntry('old-icon', 'icon_calendar.png', 'image/png'),
      ].join(''),
    })

    const index = buildDriveImageIndex(await fetchDriveImages(fetcher, { rootFolderId: 'root', warn }))

    expect(index.conflicts).toEqual([{
      baseName: 'kodeboks-1',
      paths: ['Arkiv/kodeboks-1.jpg', 'Guidebilder/kodeboks-1.jpg'],
    }])
    expect(index.files.map((file) => file.name)).toEqual(['icon_calendar.png', 'kodeboks-2.jpg'])
    expect(matchDriveImages(index.files, ['kodeboks']).kodeboks.map((image) => image.name))
      .toEqual(['kodeboks-2.jpg'])
  })

  it('treats duplicate icon base names in different folders as a conflict and reports no icon', async () => {
    const fetcher = driveFetcher({
      root: [folderEntry('icons', 'Ikoner'), folderEntry('archive', 'Arkiv')].join(''),
      icons: driveEntry('new-icon', 'icon_calendar.png', 'image/png'),
      archive: driveEntry('old-icon', 'icon_calendar.jpg', 'image/jpeg'),
    })

    const index = buildDriveImageIndex(await fetchDriveImages(fetcher, { rootFolderId: 'root' }))

    expect(index.conflicts).toEqual([{
      baseName: 'icon_calendar',
      paths: ['Arkiv/icon_calendar.jpg', 'Ikoner/icon_calendar.png'],
    }])
    expect(matchDriveIcons(index.files, ['icon_calendar'])).toEqual({ icon_calendar: null })
  })

  it('warns about each duplicate filename with all of its paths when the index is built', async () => {
    const warn = vi.fn()
    const fetcher = driveFetcher({
      root: [folderEntry('guide-images', 'Guidebilder'), folderEntry('archive', 'Arkiv')].join(''),
      'guide-images': driveEntry('code-box', 'kodeboks-1.jpg', 'image/jpeg'),
      archive: driveEntry('old-code-box', 'kodeboks-1.jpg', 'image/jpeg'),
    })

    await loadDriveImageIndex({ fetcher, warn, rootFolderId: 'root' })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('kodeboks-1')
    expect(warn.mock.calls[0][0]).toContain('Guidebilder/kodeboks-1.jpg')
    expect(warn.mock.calls[0][0]).toContain('Arkiv/kodeboks-1.jpg')
  })

  it('caches the recursive index so repeated lookups do not traverse Drive again', async () => {
    const fetcher = driveFetcher(nestedFolders)

    const first = await loadDriveImageIndex({ fetcher, rootFolderId: 'root' })
    const second = await loadDriveImageIndex({ fetcher, rootFolderId: 'root' })

    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(second).toBe(first)

    clearDriveImageIndexCache()
    await loadDriveImageIndex({ fetcher, rootFolderId: 'root' })
    expect(fetcher).toHaveBeenCalledTimes(8)
  })

  it('shares one traversal between concurrent lookups', async () => {
    const fetcher = driveFetcher(nestedFolders)

    const [first, second] = await Promise.all([
      loadDriveImageIndex({ fetcher, rootFolderId: 'root' }),
      loadDriveImageIndex({ fetcher, rootFolderId: 'root' }),
    ])

    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(second).toBe(first)
  })

  it('does not cache a failed traversal', async () => {
    const failing = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))

    await expect(loadDriveImageIndex({ fetcher: failing, rootFolderId: 'root' }))
      .rejects.toThrow('Drive folder request failed')

    const working = driveFetcher(nestedFolders)
    const index = await loadDriveImageIndex({ fetcher: working, rootFolderId: 'root' })

    expect(index.files.map((file) => file.name)).toContain('icon_calendar.png')
  })
})
