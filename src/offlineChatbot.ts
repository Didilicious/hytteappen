import type { GuideContent } from '../shared/guideContent'
import { guides } from './guideData'
import { readOfflineGuides } from './offlineGuides'
import { readContentResponse } from './guideContent'

export class ChatbotError extends Error {}

const stopWords = new Set('hva hvordan hvor hvorfor hvem når jeg vi du det den de er har kan skal må bør og i på av til med for om en et ikke får gjør'.split(' '))

function normalize(text: string) {
  return text.toLocaleLowerCase('nb-NO').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
}

function tokens(text: string) {
  return [...new Set((text.toLocaleLowerCase('nb-NO').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length > 1 && !stopWords.has(word)).map(normalize))]
}

function details(page: GuideContent, content: GuideContent[]) {
  const conditions = page.answerRequirements.map((requirement) => {
    const question = content.find((item) => item.id === requirement.questionId)
    return `Gjelder når «${question?.title ?? requirement.questionId}» er besvart med «${requirement.answer}».`
  })
  const prerequisites = page.requiredStepIds.map((id) => {
    const step = content.find((item) => item.id === id)
    return `Forutsetter at «${step?.title ?? id}» er fullført.`
  })
  return [page.title, ...conditions, ...prerequisites, page.location && `Sted: ${page.location}`,
    page.warning && `Advarsel: ${page.warning}`, ...page.instructions,
    page.checkpoints && `Kontrollpunkter: ${page.checkpoints}`,
    page.answerOptions.length > 0 && `Svaralternativer: ${page.answerOptions.join(' / ')}`,
  ].filter(Boolean).join('\n')
}

export function searchDownloadedGuides(query: string, content: GuideContent[]) {
  const terms = tokens(query)
  const scored = content.map((page) => {
    const title = normalize(page.title)
    const text = normalize([page.title, page.location, page.warning, ...page.instructions, page.checkpoints, ...page.answerOptions].join(' '))
    const words = tokens(text)
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 4 : 0)
      + (words.some((word) => word === term || (Math.min(word.length, term.length) >= 4 && (word.startsWith(term) || term.startsWith(word)))) ? 2 : 0), 0)
    const guide = Object.values(guides).find((item) => page.guides.includes(item.name))
    return { page, guide, score }
  }).filter((match) => match.score > 0 && match.guide)
    .sort((a, b) => b.score - a.score)
  const minimum = (scored[0]?.score ?? 0) * 0.62
  return scored.filter((match) => match.score >= minimum).slice(0, 3)
}

export async function answerFromDownloadedGuides(query: string) {
  let content: GuideContent[] | null | undefined
  try {
    const bundle = await readOfflineGuides()
    content = bundle && readContentResponse({ content: bundle.content })
    if (bundle && (!content || content.some((page) =>
      !Array.isArray(page.requiredStepIds) || page.requiredStepIds.some((id) => typeof id !== 'string')
      || page.instructions.some((line) => typeof line !== 'string')
      || page.answerRequirements.some((item) => !item || typeof item.questionId !== 'string' || typeof item.answer !== 'string')
    ))) throw new Error('Invalid download')
  } catch {
    throw new ChatbotError('Kunne ikke lese de nedlastede guidene. Sjekk at nettleseren tillater lokal lagring. Koble til internett og last ned guidene på nytt hvis problemet fortsetter.')
  }
  if (!content?.length) {
    throw new ChatbotError('Ingen guider er lastet ned på denne enheten, eller nedlastingen er tom. Koble til internett og last ned guidene under Offline-innhold.')
  }
  const matches = searchDownloadedGuides(query, content)
  return {
    content: matches.length
      ? `Her er relevante utdrag fra de nedlastede guidene:\n\n${matches.map(({ page }) => details(page, content!)).join('\n\n')}`
      : 'Jeg fant ikke noe relevant i de nedlastede guidene. Prøv andre søkeord. Opplysninger om bookinger, familie og oppslagstavle krever internett.',
    sources: matches.map(({ page, guide }) => ({
      label: `${guide!.title}: ${page.title}`,
      path: `/guide/${guide!.id}/${encodeURIComponent(page.id)}`,
    })),
  }
}
