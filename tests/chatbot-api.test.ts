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

function createFunction(fetchOpenAI: typeof fetch, authenticate = () => authenticatedUser) {
  return createChatbotFunction({
    authenticate,
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
      output: [{ content: [{ type: 'output_text', text: 'Ta med én sekk og sjekk beholdningen når dere kommer.' }] }],
    }), { status: 200 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())
    const requestBody = JSON.parse(fetchOpenAI.mock.calls[0][1].body as string)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Ta med én sekk og sjekk beholdningen når dere kommer.',
    })
    expect(fetchOpenAI).toHaveBeenCalledWith(
      'https://api.openai.example/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(requestBody.model).toBe('gpt-5.4-nano')
    expect(requestBody.instructions).toContain('Hytteappen')
    expect(requestBody.instructions).toContain('Svar på norsk')
    expect(requestBody.instructions).toContain('ikke tilgang til nettsøk')
  })

  it('returns a useful error when OpenAI is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchOpenAI = vi.fn().mockResolvedValue(new Response('', { status: 429 }))
    const response = await createFunction(fetchOpenAI as unknown as typeof fetch)(createRequest())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ message: 'Chatboten kunne ikke svare. Prøv igjen.' })
    consoleError.mockRestore()
  })
})
