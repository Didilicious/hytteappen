import type { Config } from '@netlify/functions'
import {
  clearSessionCookie,
  getAuthenticatedFamilyMember,
  jsonResponse,
  type FamilyMember,
} from './_shared/session.mts'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatbotDependencies = {
  authenticate: (request: Request) => FamilyMember | null
  fetchOpenAI: typeof fetch
  getApiKey: () => string | undefined
  getBaseUrl: () => string
}

const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 2_000

function readMessages(value: unknown): ChatMessage[] | null {
  if (!value || typeof value !== 'object') return null

  const messages = (value as { messages?: unknown }).messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null

  const parsedMessages: ChatMessage[] = []

  for (const message of messages) {
    if (!message || typeof message !== 'object') return null

    const { role, content } = message as Partial<ChatMessage>
    const trimmedContent = typeof content === 'string' ? content.trim() : ''

    if (
      (role !== 'user' && role !== 'assistant')
      || !trimmedContent
      || trimmedContent.length > MAX_MESSAGE_LENGTH
    ) {
      return null
    }

    parsedMessages.push({ role, content: trimmedContent })
  }

  return parsedMessages.at(-1)?.role === 'user' ? parsedMessages : null
}

function readResponseText(value: unknown) {
  if (!value || typeof value !== 'object') return null

  const response = value as {
    output_text?: unknown
    output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>
  }

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text as string)
    .join('\n')
    .trim()

  return text || null
}

export function createChatbotFunction({
  authenticate,
  fetchOpenAI,
  getApiKey,
  getBaseUrl,
}: ChatbotDependencies) {
  return async function chatbotFunction(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
    }

    try {
      const familyMember = authenticate(request)

      if (!familyMember) {
        return jsonResponse(
          { message: 'Økten har utløpt. Logg inn på nytt.' },
          { status: 401, headers: { 'Set-Cookie': clearSessionCookie(request) } },
        )
      }

      let requestBody: unknown
      try {
        requestBody = await request.json()
      } catch {
        return jsonResponse({ message: 'Meldingen kunne ikke sendes.' }, { status: 400 })
      }

      const messages = readMessages(requestBody)
      if (!messages) {
        return jsonResponse({ message: 'Meldingen kunne ikke sendes.' }, { status: 400 })
      }

      const apiKey = getApiKey()
      if (!apiKey) {
        return jsonResponse({ message: 'Chatboten er ikke tilgjengelig akkurat nå.' }, { status: 503 })
      }

      const openAIResponse = await fetchOpenAI(`${getBaseUrl().replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.4-nano',
          instructions: [
            'Du er den hjelpsomme assistenten i familiens Hytteappen.',
            'Svar på norsk som standard, kortfattet, vennlig og praktisk.',
            `Brukerens navn er ${familyMember.displayName}.`,
            'Du har foreløpig ikke tilgang til nettsøk eller data i Hytteappen.',
            'Ikke påstå at du har lest appdata. Be om nødvendige detaljer når noe mangler.',
          ].join(' '),
          input: messages,
          reasoning: { effort: 'low' },
          text: { verbosity: 'low' },
          max_output_tokens: 600,
        }),
        signal: AbortSignal.timeout(25_000),
      })

      if (!openAIResponse.ok) {
        console.error(`OpenAI request failed with status ${openAIResponse.status}`)
        return jsonResponse({ message: 'Chatboten kunne ikke svare. Prøv igjen.' }, { status: 502 })
      }

      const message = readResponseText(await openAIResponse.json())
      if (!message) {
        return jsonResponse({ message: 'Chatboten kunne ikke svare. Prøv igjen.' }, { status: 502 })
      }

      return jsonResponse({ message })
    } catch {
      console.error('Chatbot request failed')
      return jsonResponse({ message: 'Chatboten er ikke tilgjengelig akkurat nå.' }, { status: 500 })
    }
  }
}

export default createChatbotFunction({
  authenticate: getAuthenticatedFamilyMember,
  fetchOpenAI: fetch,
  getApiKey: () => process.env.OPENAI_API_KEY,
  getBaseUrl: () => process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
})

export const config: Config = {
  method: 'POST',
}
