import { describe, expect, it } from 'vitest'
import { rankAppKnowledge, type AppKnowledgeData } from '../netlify/functions/_shared/chatbot-knowledge.mts'

const emptyData: AppKnowledgeData = {
  guides: [],
  posts: [],
  comments: [],
  bookings: [],
  events: [],
  profiles: [],
}

describe('Hytteappen knowledge retrieval', () => {
  it('finds a precise guide step and preserves its real route', () => {
    const matches = rankAppKnowledge('Hvordan skrur jeg på vannet?', {
      ...emptyData,
      guides: [{
        id: 'start-water',
        guides: ['Åpne'],
        type: 'step',
        afterId: null,
        requiredStepIds: [],
        answerRequirements: [],
        title: 'Skru på vannet',
        location: 'Teknisk rom',
        warning: null,
        instructions: ['Åpne hovedkranen langsomt.'],
        checkpoints: 'Kontroller at det ikke lekker.',
        answerOptions: [],
        canSkip: true,
        imageGroup: null,
      }],
    }, new Date('2026-09-03T12:00:00Z'))

    expect(matches[0]).toEqual(expect.objectContaining({
      source: {
        label: 'Åpne hytte: Skru på vannet',
        path: '/guide/open-cabin/start-water',
      },
    }))
    expect(matches[0].context).toContain('Åpne hovedkranen langsomt')
  })

  it('answers booking availability from the absence of overlapping bookings', () => {
    const matches = rankAppKnowledge(
      'Er hytta ledig i helgen?',
      emptyData,
      new Date('2026-09-03T12:00:00Z'),
    )

    expect(matches[0]).toEqual({
      context: 'Hyttebooking: Ingen bookinger er registrert for 5. september 2026–6. september 2026.',
      source: { label: 'Hyttekalender', path: '/booking/calendar?month=2026-09' },
    })
  })

  it('finds birthdays and links to the matching family profile', () => {
    const matches = rankAppKnowledge(
      'Når har Othelie bursdag?',
      emptyData,
      new Date('2026-09-03T12:00:00Z'),
    )

    expect(matches[0].context).toContain('Othelie')
    expect(matches[0].context).toContain('7. mai')
    expect(matches[0].source.path).toBe('/familieoversikt/christine')
  })

  it('fuzzily matches a key question to content about the key box', () => {
    const matches = rankAppKnowledge('Hvor er nøkkelen?', {
      ...emptyData,
      guides: [{
        id: 'key-box',
        guides: ['Åpne'],
        type: 'step',
        afterId: null,
        requiredStepIds: [],
        answerRequirements: [],
        title: 'Nøkkelboksen',
        location: 'Ved inngangsdøren',
        warning: null,
        instructions: ['Åpne nøkkelboksen med koden.'],
        checkpoints: null,
        answerOptions: [],
        canSkip: true,
        imageGroup: null,
      }],
    }, new Date('2026-09-04T12:00:00Z'))

    expect(matches).toHaveLength(1)
    expect(matches[0].context).toContain('Ved inngangsdøren')
    expect(matches[0].source.path).toBe('/guide/open-cabin/key-box')
  })

  it('keeps complementary birthday records for the same person', () => {
    const matches = rankAppKnowledge('Når er Heidis bursdag?', {
      ...emptyData,
      events: [{
        id: 'heidi-birthday',
        ownerId: 'heidi',
        eventType: 'birthday',
        title: 'Heidi 34 år',
        startDate: '2027-02-06',
        endDate: null,
        startTime: '16:00',
        endTime: '20:00',
        location: 'Hjemme hos Heidi',
        wishlistUrl: '',
        moreInfo: 'Kake fra klokken 16.',
        createdAt: '2026-09-01T12:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
      }],
    }, new Date('2026-09-04T12:00:00Z'))

    expect(matches.map((match) => match.source.path)).toEqual([
      '/familieoversikt/heidi',
      '/booking/event/heidi-birthday',
    ])
  })

  it('discards weak unrelated records when one guide step is clearly strongest', () => {
    const matches = rankAppKnowledge('Hvor er nøkkelen?', {
      ...emptyData,
      guides: [{
        id: 'key-box',
        guides: ['Åpne'],
        type: 'step',
        afterId: null,
        requiredStepIds: [],
        answerRequirements: [],
        title: 'Nøkkelboksen',
        location: 'Ved inngangsdøren',
        warning: null,
        instructions: ['Koden står i appen.'],
        checkpoints: null,
        answerOptions: [],
        canSkip: true,
        imageGroup: null,
      }],
      posts: [{
        id: 'loose-key-mention',
        ownerId: 'anette',
        type: 'Info',
        title: 'Dugnad',
        description: 'Ta med nøkkelring til boden.',
        status: 'open',
        createdAt: '2026-09-01T12:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
      }],
    }, new Date('2026-09-04T12:00:00Z'))

    expect(matches.map((match) => match.source.path)).toEqual(['/guide/open-cabin/key-box'])
  })
})
