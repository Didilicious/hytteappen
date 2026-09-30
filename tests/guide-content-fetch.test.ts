import { describe, expect, it, vi } from 'vitest'
import { guideSheetUrl, readGuideContent } from '../netlify/functions/_shared/guide-content.mts'

const headers = [
  'ID',
  'Guide',
  'Type',
  'Etter',
  'Krever steg',
  'Krever svar',
  'Tittel / Spørsmål',
  'Sted',
  'Advarsler / viktige påminnelser',
  'Instruksjoner (én linje = ett punkt)',
  'Hva bør kontrolleres etterpå?',
  'Svaralternativer',
  'Kan hoppes over',
  'Bildegruppe',
  'Publisert',
]

const validCsv = [
  headers.join(','),
  'strom,Drift,Steg,,,,Strøm,,,,,,,,JA',
].join('\n')

describe('Google Sheet guide content fetch', () => {
  it('requests the worksheet containing the guide data explicitly', () => {
    expect(new URL(guideSheetUrl).searchParams.get('gid')).toBe('951480919')
  })

  it('retries a transient network failure and returns normalized content', async () => {
    const fetchSheet = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce(new Response(validCsv, { status: 200 }))

    const content = await readGuideContent(fetchSheet, () => undefined)

    expect(fetchSheet).toHaveBeenCalledTimes(2)
    expect(content).toHaveLength(1)
    expect(content[0]).toMatchObject({ id: 'strom', title: 'Strøm', guides: ['Drift'] })
    expect(fetchSheet.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries retryable upstream responses', async () => {
    const fetchSheet = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(validCsv, { status: 200 }))

    await expect(readGuideContent(fetchSheet, () => undefined)).resolves.toHaveLength(1)
    expect(fetchSheet).toHaveBeenCalledTimes(2)
  })

  it('does not retry a permanent client response', async () => {
    const fetchSheet = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 404 }))

    await expect(readGuideContent(fetchSheet, () => undefined)).rejects.toThrow('status 404')
    expect(fetchSheet).toHaveBeenCalledTimes(1)
  })

  it('fails after two unavailable responses', async () => {
    const fetchSheet = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 503 }))

    await expect(readGuideContent(fetchSheet, () => undefined)).rejects.toThrow('status 503')
    expect(fetchSheet).toHaveBeenCalledTimes(2)
  })
})
