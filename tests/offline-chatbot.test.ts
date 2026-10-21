import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import { answerFromDownloadedGuides, searchDownloadedGuides } from '../src/offlineChatbot'

const { readOfflineGuides } = vi.hoisted(() => ({ readOfflineGuides: vi.fn() }))
vi.mock('../src/offlineGuides', () => ({ readOfflineGuides }))

const water: GuideContent = {
  id: 'water & pump', title: 'Vannpumpe', guides: ['Drift'], type: 'step', afterId: null,
  requiredStepIds: ['power'], answerRequirements: [{ questionId: 'water-question', answer: 'Nei' }],
  location: 'Kjelleren', warning: 'Slå av strømmen før kontroll.', instructions: ['Kontroller pumpen.'],
  checkpoints: 'Sjekk at det ikke lekker.', answerOptions: [], canSkip: false, imageGroup: null,
}
const power: GuideContent = { ...water, id: 'power', title: 'Strøm', instructions: ['Slå på hovedbryteren.'], requiredStepIds: [], answerRequirements: [] }
const question: GuideContent = { ...power, id: 'water-question', title: 'Kommer det vann?', type: 'question', answerOptions: ['Ja', 'Nei'] }

beforeEach(() => { readOfflineGuides.mockReset() })

describe('downloaded guide chatbot search', () => {
  it('finds Norwegian questions, word forms and compounds across all four guides', () => {
    for (const name of ['Åpne', 'Stenge', 'Drift', 'Feilsøking'] as const) {
      expect(searchDownloadedGuides('Hvordan kontrollerer jeg vannpumpen?', [{ ...water, guides: [name] }])[0]?.page.id).toBe(water.id)
    }
    expect(searchDownloadedGuides('Hvor er strommen?', [power])[0]?.page.id).toBe(power.id)
  })

  it('returns only downloaded excerpts with warnings, conditions, prerequisites and encoded source links', async () => {
    readOfflineGuides.mockResolvedValue({ content: [water, power, question] })
    const answer = await answerFromDownloadedGuides('vannpumpe')
    expect(answer.content).toContain(water.warning)
    expect(answer.content).toContain('«Kommer det vann?» er besvart med «Nei»')
    expect(answer.content).toContain('«Strøm» er fullført')
    expect(answer.sources).toEqual([{ label: 'Drift av hytte: Vannpumpe', path: '/guide/cabin-operations/water%20%26%20pump' }])
  })

  it('does not invent answers for unrelated questions or conversational filler', async () => {
    readOfflineGuides.mockResolvedValue({ content: [water] })
    expect((await answerFromDownloadedGuides('Hvem har booket hytta i helgen?')).sources).toEqual([])
    expect((await answerFromDownloadedGuides('Hvordan gjør jeg det?')).content).toContain('Jeg fant ikke noe relevant')
  })

  it('reads the current download on every question, including after deletion', async () => {
    readOfflineGuides.mockResolvedValueOnce({ content: [water] }).mockResolvedValueOnce(undefined)
    expect((await answerFromDownloadedGuides('vannpumpe')).sources).toHaveLength(1)
    await expect(answerFromDownloadedGuides('vannpumpe')).rejects.toThrow('Ingen guider er lastet ned')
  })

  it('explains empty, corrupt and inaccessible storage in Norwegian', async () => {
    readOfflineGuides.mockResolvedValue({ content: [] })
    await expect(answerFromDownloadedGuides('vann')).rejects.toThrow('nedlastingen er tom')
    readOfflineGuides.mockResolvedValue({ content: 'broken' })
    await expect(answerFromDownloadedGuides('vann')).rejects.toThrow('Kunne ikke lese de nedlastede guidene')
    readOfflineGuides.mockRejectedValue(new DOMException('Storage blocked', 'SecurityError'))
    await expect(answerFromDownloadedGuides('vann')).rejects.toThrow('Sjekk at nettleseren tillater lokal lagring')
  })
})
