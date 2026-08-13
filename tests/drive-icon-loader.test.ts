import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadHomeIcons } from '../src/guideImages'

describe('Drive icon loader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads distinct icon sets separately so booking icons remain available after home icons', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input), 'https://example.test')
      const iconNames = url.searchParams.getAll('icon')

      return new Response(JSON.stringify({
        iconsByName: Object.fromEntries(iconNames.map((name) => [name, {
          name: `${name}.png`,
          src: `https://drive.example/${name}`,
        }])),
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const homeIcons = await loadHomeIcons(['icon_cabin_open', 'icon_calendar'])
    const bookingIcons = await loadHomeIcons(['icon_calendar_booking', 'icon_calendar_new', 'icon_calendar_edit'])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(homeIcons.icon_calendar?.name).toBe('icon_calendar.png')
    expect(bookingIcons.icon_calendar_booking?.name).toBe('icon_calendar_booking.png')
    expect(bookingIcons.icon_calendar_new?.name).toBe('icon_calendar_new.png')
    expect(bookingIcons.icon_calendar_edit?.name).toBe('icon_calendar_edit.png')
  })
})
