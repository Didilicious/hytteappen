import { describe, expect, it, vi } from 'vitest'
import { createChatbotFunction } from '../netlify/functions/chatbot.mts'

const authenticatedUser = { id: 'anette', displayName: 'Anette' }

function createRequest(body: unknown = { messages: [{ role: 'user', content: 'Hvor mye ved bør vi ta med?' }] }) {
  return new Request('https://example.com/.netlify/functions/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const defaultKnowledge = [{
  context: 'Guide: Åpne hytte. Steg: Ved. Ta med én sekk ved.',
  source: { label: 'Åpne hytte: Ved', path: '/guide/open-cabin/ved' },
}]

function createFunction(
  fetchOpenAI: typeof fetch,
  authenticate = () => authenticatedUser,
  retrieveKnowledge = async () => defaultKnowledge,
) {
  return createChatbotFunction({
    authenticate,
    retrieveKnowledge,
    fetchOpenAI,
    getApiKey: () => 'test-api-key',
    getBaseUrl: () => 'https://api.openai.example/v1',
  })
}

describe('chatbot function', () => {
  it('requires an authenticated family session', async () => {
    const fetchOpenAI = vi.fn()
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch, () => null)(createRequest())

    expect(response.status).toBe(401)
    expect(fetchOpenAI).not.toHaveBeenCalled()
  })

  it('rejects invalid or oversized conversations', async () => {
    const fetchOpenAI = vi.fn()
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest({
      messages: [{ role: 'user', content: 'x'.repeat(2_001) }],
    }))

    expect(response.status).toBe(400)
    expect(fetchOpenAI).not.toHaveBeenCalled()
  })

  it('sends concise Norwegian app context to OpenAI', async () => {
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{ content: [{
        type: 'output_text',
        text: JSON.stringify({
          answer: 'Ta med én sekk og sjekk beholdningen når dere kommer.',
          source_ids: [1],
        }),
      }] }],
    }), { status: 200 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())
    const requestBody = JSON.parse(fetchOpenAI.mock.calls[0][1].body as string)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Ta med én sekk og sjekk beholdningen når dere kommer.',
      sources: [{ label: 'Åpne hytte: Ved', path: '/guide/open-cabin/ved' }],
    })
    expect(fetchOpenAI).toHaveBeenCalledWith(
      'https://api.openai.example/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(requestBody.model).toBe('gpt-5.4-nano')
    expect(requestBody.instructions).toContain('Hytteappen')
    expect(requestBody.instructions).toContain('Svar på norsk')
    expect(requestBody.instructions).toContain('ikke bruk nettsøk')
    expect(requestBody.input[0].content).toContain('Ta med én sekk ved')
    expect(requestBody.text.format.type).toBe('json_schema')
  })

  it('retrieves only for the current user message', async () => {
    const retrieveKnowledge = vi.fn().mockResolvedValue(defaultKnowledge)
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ answer: 'Nøkkelen ligger i nøkkelboksen.', source_ids: [1] }),
    }), { status: 200 }))

    await createFunction(fetchOpenAI as unknown as typeof fetch, () => authenticatedUser, retrieveKnowledge)(createRequest({
      messages: [
        { role: 'user', content: 'Når har Heidi bursdag?' },
        { role: 'assistant', content: 'Heidi har bursdag 6. februar.' },
        { role: 'user', content: 'Hvor er nøkkelen?' },
      ],
    }))

    expect(retrieveKnowledge).toHaveBeenCalledWith('Hvor er nøkkelen?', authenticatedUser)
  })

  it('returns only sources explicitly used in the current answer', async () => {
    const knowledge = [
      defaultKnowledge[0],
      {
        context: 'Familieprofil: Heidi. Bursdag: 6. februar.',
        source: { label: 'Familieprofil: Heidi', path: '/familieoversikt/heidi' },
      },
    ]
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ answer: 'Ta med én sekk ved.', source_ids: [1, 99] }),
    }), { status: 200 }))

    const response = await createFunction(
      fetchOpenAI as unknown as typeof fetch,
      () => authenticatedUser,
      async () => knowledge,
    )(createRequest())

    await expect(response.json()).resolves.toEqual({
      message: 'Ta med én sekk ved.',
      sources: [{ label: 'Åpne hytte: Ved', path: '/guide/open-cabin/ved' }],
    })
  })

  it('does not call OpenAI when Hytteappen has no relevant information', async () => {
    const fetchOpenAI = vi.fn()
    const chatbot = createChatbotFunction({
      authenticate: () => authenticatedUser,
      retrieveKnowledge: async () => [],
      fetchOpenAI: fetchOpenAI as unknown as typeof fetch,
      getApiKey: () => 'test-api-key',
      getBaseUrl: () => 'https://api.openai.example/v1',
    })

    const response = await chatbot(createRequest())

    expect(fetchOpenAI).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      message: 'Jeg fant ikke svar på dette i Hytteappen.',
      sources: [],
    })
  })

  it('returns a useful error when OpenAI is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response('', { status: 429 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ message: 'Chatboten kunne ikke svare. Prøv igjen.' })
    consoleError.mockRestore()
  })

  it('rejects an unstructured model response instead of guessing sources', async () => {
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: 'Ta med ved.',
    }), { status: 200 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ message: 'Chatboten kunne ikke svare. Prøv igjen.' })
  })

  it('rejects a substantive answer without an explicitly used source', async () => {
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ answer: 'Ta med ved.', source_ids: [] }),
    }), { status: 200 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ message: 'Chatboten kunne ikke svare. Prøv igjen.' })
  })
})
