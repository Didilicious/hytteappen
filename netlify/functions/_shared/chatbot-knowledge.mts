import type { Booking } from './bookings.mts'
import type { FamilyEvent } from '../../../shared/familyEvents.ts'
import type { GuideContent } from '../../../shared/guideContent.ts'
import type { MemberProfile } from '../../../shared/memberProfiles.ts'
import type { NoticeboardComment, NoticeboardPost } from '../../../shared/noticeboard.ts'
import { families } from '../../../shared/families.ts'
import { getFamilyMember } from '../../../shared/familyMembers.ts'
import { readBookings } from './bookings.mts'
import { readFamilyEvents } from './family-events.mts'
import { readGuideContent } from './guide-content.mts'
import { readMemberProfile } from './member-profiles.mts'
import { readAllNoticeboardComments } from './noticeboard-comments.mts'
import { readAllNoticeboardPosts } from './noticeboard-posts.mts'
import type { FamilyMember } from './session.mts'

export type ChatbotSource = {
  label: string
  path: string
}

export type AppKnowledgeMatch = {
  context: string
  source: ChatbotSource
}

type KnowledgeDocument = AppKnowledgeMatch & {
  recordKey: string
  category: 'guide' | 'noticeboard' | 'booking' | 'event' | 'family'
  searchText: string
  subjects: string[]
  facets: Array<'contact' | 'date' | 'location'>
  dateRange?: { from: string; to: string }
}

export type AppKnowledgeData = {
  guides: GuideContent[]
  posts: NoticeboardPost[]
  comments: NoticeboardComment[]
  bookings: Booking[]
  events: FamilyEvent[]
  profiles: MemberProfile[]
}

type KnowledgeDependencies = {
  loadGuides: () => Promise<GuideContent[]>
  loadPosts: () => Promise<NoticeboardPost[]>
  loadComments: () => Promise<NoticeboardComment[]>
  loadBookings: () => Promise<Booking[]>
  loadEvents: () => Promise<FamilyEvent[]>
  loadProfiles: () => Promise<MemberProfile[]>
  now: () => Date
}

const guideIds = {
  Åpne: { id: 'open-cabin', title: 'Åpne hytte' },
  Stenge: { id: 'close-cabin', title: 'Stenge hytte' },
  Drift: { id: 'cabin-operations', title: 'Drift av hytte' },
} as const

const stopWords = new Set([
  'at', 'av', 'den', 'det', 'du', 'en', 'er', 'et', 'for', 'fra', 'har', 'hva', 'hvem', 'hvor',
  'hvordan', 'i', 'ikke', 'jeg', 'kan', 'med', 'naar', 'og', 'om', 'paa', 'skal', 'som', 'til', 'vi',
])

const semanticConceptAliases = {
  key: ['nøkkel', 'nøkkelboks', 'nøkkelskap', 'kodeboks', 'keybox', 'adgangskode'],
  birthday: ['bursdag', 'fødselsdag', 'birthday', 'fyller år'],
  booking: ['booking', 'bestilling', 'booket', 'ledig', 'opphold', 'på hytta'],
  contact: ['kontakt', 'telefon', 'mobil', 'epost', 'email', 'adresse'],
  electricity: ['strøm', 'sikring', 'sikringsskap', 'elektrisk', 'stikkontakt'],
  firewood: ['ved', 'peis', 'ovn', 'fyring', 'opptenning'],
  internet: ['internett', 'wifi', 'wi-fi', 'nettverk', 'passord'],
  security: ['alarm', 'låse', 'lås', 'kode', 'sikkerhet'],
  water: ['vann', 'hovedkran', 'stoppekran', 'kran', 'pumpe'],
} as const

const normalizedConceptAliases = Object.entries(semanticConceptAliases).map(([concept, aliases]) => ({
  concept,
  aliases: aliases.map(normalize),
}))

const knownSubjectNames = [...new Set(families.flatMap((family) => [
  family.displayName,
  ...family.members.map((member) => member.displayName),
]))]
  .map(normalize)
  .filter((name) => name.length >= 3)

const monthNames: Record<string, number> = {
  januar: 1,
  februar: 2,
  mars: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
}

const dateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
})

function normalize(value: string) {
  return value
    .toLocaleLowerCase('nb-NO')
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'o')
    .replaceAll('å', 'aa')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stem(token: string) {
  if (token.length > 7 && token.endsWith('ene')) return token.slice(0, -3)
  if (token.length > 6 && token.endsWith('er')) return token.slice(0, -2)
  if (token.length > 6 && token.endsWith('en')) return token.slice(0, -2)
  return token
}

function tokenize(value: string) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .map(stem)
}

function characterBigrams(value: string) {
  if (value.length < 2) return new Set([value])
  return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)))
}

function diceSimilarity(first: string, second: string) {
  const firstBigrams = characterBigrams(first)
  const secondBigrams = characterBigrams(second)
  let intersection = 0

  for (const bigram of firstBigrams) {
    if (secondBigrams.has(bigram)) intersection += 1
  }

  return (2 * intersection) / (firstBigrams.size + secondBigrams.size)
}

function tokenSimilarity(queryToken: string, documentToken: string) {
  if (queryToken === documentToken) return 1
  if (
    Math.min(queryToken.length, documentToken.length) >= 4
    && (queryToken.startsWith(documentToken) || documentToken.startsWith(queryToken))
  ) return 0.9

  return diceSimilarity(queryToken, documentToken)
}

function findConcepts(value: string) {
  const normalizedValue = ` ${normalize(value)} `
  return new Set(normalizedConceptAliases
    .filter(({ aliases }) => aliases.some((alias) => normalizedValue.includes(` ${alias} `)
      || tokenize(alias).some((aliasToken) => tokenize(normalizedValue).some((token) => tokenSimilarity(aliasToken, token) >= 0.9))))
    .map(({ concept }) => concept))
}

function findQuerySubjects(query: string) {
  const normalizedQuery = ` ${normalize(query)} `
  return knownSubjectNames.filter((name) => (
    normalizedQuery.includes(` ${name} `) || normalizedQuery.includes(` ${name}s `)
  ))
}

function findDocumentSubjects(value: string) {
  const normalizedValue = ` ${normalize(value)} `
  return knownSubjectNames.filter((name) => normalizedValue.includes(` ${name} `))
}

function queryFacets(query: string) {
  const value = normalize(query)
  const facets = new Set<KnowledgeDocument['facets'][number]>()
  if (/\b(hvor|plassering|sted)\b/.test(value)) facets.add('location')
  if (/\b(naar|dato|dag|helg|bursdag|foedselsdag)\b/.test(value)) facets.add('date')
  if (/\b(kontakt|telefon|mobil|epost|email|adresse)\b/.test(value)) facets.add('contact')
  return facets
}

function truncate(value: string, maxLength = 700) {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

function formatDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? dateKey : dateFormatter.format(date)
}

function formatDateRange(from: string, to: string) {
  return from === to ? formatDate(from) : `${formatDate(from)}–${formatDate(to)}`
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function osloToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Oslo',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return new Date(`${values.year}-${values.month}-${values.day}T12:00:00Z`)
}

function weekendRange(today: Date, offsetWeeks: number) {
  const daysUntilSaturday = (6 - today.getUTCDay() + 7) % 7
  const saturday = addDays(today, daysUntilSaturday + offsetWeeks * 7)
  return { from: dateKey(saturday), to: dateKey(addDays(saturday, 1)) }
}

function parseRequestedDateRange(query: string, now: Date) {
  const normalizedQuery = normalize(query)
  const today = osloToday(now)

  if (/\b(overmorgen)\b/.test(normalizedQuery)) {
    const key = dateKey(addDays(today, 2))
    return { from: key, to: key }
  }
  if (/\b(i morgen|imorgen)\b/.test(normalizedQuery)) {
    const key = dateKey(addDays(today, 1))
    return { from: key, to: key }
  }
  if (/\b(i dag|idag|naa)\b/.test(normalizedQuery)) {
    const key = dateKey(today)
    return { from: key, to: key }
  }
  if (/\b(neste helg)\b/.test(normalizedQuery)) return weekendRange(today, 1)
  if (/\b(denne helg|denne helgen|i helg|i helgen)\b/.test(normalizedQuery)) return weekendRange(today, 0)

  const isoRange = query.match(/\b(\d{4}-\d{2}-\d{2})\s*(?:-|–|til)\s*(\d{4}-\d{2}-\d{2})\b/)
  if (isoRange) return { from: isoRange[1], to: isoRange[2] }

  const namedRange = query.match(/\b(\d{1,2})\s*\.?\s*(?:-|–|til)\s*(\d{1,2})\s*\.?\s*([a-zæøå]+)(?:\s+(\d{4}))?/i)
  if (namedRange) {
    const month = monthNames[namedRange[3].toLocaleLowerCase('nb-NO')]
    const year = Number(namedRange[4] ?? today.getUTCFullYear())
    if (month) {
      return {
        from: `${year}-${String(month).padStart(2, '0')}-${namedRange[1].padStart(2, '0')}`,
        to: `${year}-${String(month).padStart(2, '0')}-${namedRange[2].padStart(2, '0')}`,
      }
    }
  }

  const singleNamedDate = query.match(/\b(\d{1,2})\s*\.?\s*([a-zæøå]+)(?:\s+(\d{4}))?/i)
  if (singleNamedDate) {
    const month = monthNames[singleNamedDate[2].toLocaleLowerCase('nb-NO')]
    const year = Number(singleNamedDate[3] ?? today.getUTCFullYear())
    if (month) {
      const key = `${year}-${String(month).padStart(2, '0')}-${singleNamedDate[1].padStart(2, '0')}`
      return { from: key, to: key }
    }
  }

  return null
}

function rangesOverlap(first: { from: string; to: string }, second: { from: string; to: string }) {
  return first.from <= second.to && second.from <= first.to
}

function buildDocuments(data: AppKnowledgeData): KnowledgeDocument[] {
  const documents: KnowledgeDocument[] = []

  for (const guide of data.guides) {
    for (const guideName of guide.guides) {
      const metadata = guideIds[guideName]
      const details = [guide.location, guide.warning, ...guide.instructions, guide.checkpoints, ...guide.answerOptions]
        .filter((value): value is string => Boolean(value))
      documents.push({
        recordKey: `guide:${guide.id}`,
        category: 'guide',
        searchText: `${metadata.title} ${guide.title} ${details.join(' ')}`,
        subjects: [],
        facets: guide.location ? ['location'] : [],
        context: truncate(`Guide: ${metadata.title}. Steg: ${guide.title}. ${details.join(' ')}`),
        source: {
          label: `${metadata.title}: ${guide.title}`,
          path: `/guide/${metadata.id}/${encodeURIComponent(guide.id)}`,
        },
      })
    }
  }

  const commentsByPost = new Map<string, NoticeboardComment[]>()
  for (const comment of data.comments) {
    commentsByPost.set(comment.postId, [...(commentsByPost.get(comment.postId) ?? []), comment])
  }
  for (const post of data.posts) {
    const comments = commentsByPost.get(post.id) ?? []
    const commentText = comments.map((comment) => `${getFamilyMember(comment.ownerId)?.displayName ?? 'Ukjent'}: ${comment.text}`).join(' ')
    documents.push({
      recordKey: `noticeboard:${post.id}`,
      category: 'noticeboard',
      searchText: `oppslagstavle ${post.type} ${post.status} ${post.title} ${post.description} ${commentText}`,
      subjects: findDocumentSubjects(`${post.title} ${post.description} ${commentText}`),
      facets: [],
      context: truncate(`Oppslagstavle (${post.status === 'solved' ? 'løst' : 'åpent'}): ${post.title}. ${post.description} ${commentText}`),
      source: { label: `Oppslagstavle: ${post.title}`, path: `/noticeboard/${encodeURIComponent(post.id)}` },
    })
  }

  for (const booking of data.bookings) {
    const owner = getFamilyMember(booking.ownerId)?.displayName ?? 'Ukjent familie'
    const details = [
      booking.welcomesOthers ? 'ønsker andre velkommen' : 'ønsker hytta for seg selv',
      booking.partialFamily ? 'deler av familien kommer' : 'hele familien kommer',
      booking.comment,
    ].filter(Boolean).join('. ')
    documents.push({
      recordKey: `booking:${booking.id}`,
      category: 'booking',
      searchText: `hytte booking bestilling kalender ${owner} ${booking.fromDate} ${booking.toDate} ${formatDateRange(booking.fromDate, booking.toDate)} ${details}`,
      subjects: findDocumentSubjects(owner),
      facets: ['date'],
      context: truncate(`Hyttebooking: ${owner}, ${formatDateRange(booking.fromDate, booking.toDate)}. ${details}`),
      source: { label: `Hyttebooking: ${owner}`, path: `/booking/${encodeURIComponent(booking.id)}` },
      dateRange: { from: booking.fromDate, to: booking.toDate },
    })
  }

  for (const event of data.events) {
    const owner = getFamilyMember(event.ownerId)?.displayName ?? 'Ukjent familie'
    const endDate = event.endDate ?? event.startDate
    const details = [event.location, event.startTime && `${event.startTime}–${event.endTime}`, event.moreInfo].filter(Boolean).join('. ')
    documents.push({
      recordKey: `event:${event.id}`,
      category: 'event',
      searchText: `familiekalender arrangement event ${event.eventType} ${event.title} ${owner} ${event.startDate} ${endDate} ${formatDateRange(event.startDate, endDate)} ${details}`,
      subjects: findDocumentSubjects(event.title),
      facets: event.location ? ['date', 'location'] : ['date'],
      context: truncate(`Familiekalender: ${event.title}, ${formatDateRange(event.startDate, endDate)}. Opprettet av ${owner}. ${details}`),
      source: { label: `Kalender: ${event.title}`, path: `/booking/event/${encodeURIComponent(event.id)}` },
      dateRange: { from: event.startDate, to: endDate },
    })
  }

  const profiles = new Map(data.profiles.map((profile) => [`${profile.familyId}/${profile.memberId}`, profile]))
  for (const family of families) {
    for (const member of family.members) {
      const profile = profiles.get(`${family.accountId}/${member.id}`)
      const contacts = [
        ...(profile?.phones ?? []).map((entry) => `${entry.label}: ${entry.value}`),
        ...(profile?.emails ?? []).map((entry) => `${entry.label}: ${entry.value}`),
        ...(profile?.addresses ?? []).map((entry) => `${entry.label}: ${entry.value}`),
      ]
      const birthday = `${member.birthday.day}. ${Object.keys(monthNames)[member.birthday.month - 1]}`
      documents.push({
        recordKey: `family:${family.accountId}:${member.id}`,
        category: 'family',
        searchText: `familie medlem kontakt telefon mobil epost email adresse bursdag fødselsdag ${family.displayName} ${member.displayName} ${birthday} ${contacts.join(' ')}`,
        subjects: [normalize(member.displayName)],
        facets: contacts.length > 0 ? ['date', 'contact'] : ['date'],
        context: truncate(`Familieprofil: ${member.displayName} i ${family.displayName}. Bursdag: ${birthday}. ${contacts.join('. ') || 'Ingen kontaktopplysninger er registrert.'}`),
        source: { label: `Familieprofil: ${member.displayName}`, path: `/familieoversikt/${encodeURIComponent(family.accountId)}` },
      })
    }
  }

  return documents
}

function queryCategories(query: string) {
  const value = normalize(query)
  const categories = new Set<KnowledgeDocument['category']>()
  if (/\b(guide|aapn\w*|steng\w*|drift|hyttebok|instruks\w*|alarm|vann\w*|strom\w*|peis\w*|ved)\b/.test(value)) categories.add('guide')
  if (/\b(oppslag|oppslagstavle|innlegg|kommentar|gjoeres|lost)\b/.test(value)) categories.add('noticeboard')
  if (/\b(booking|booket|bestilt|bestilling|ledig|kalender|helg)\b/.test(value) || /\bpaa hytta\b/.test(value)) categories.add('booking')
  if (/\b(arrangement|hendelse|kalender|skjer|middag|tur)\b/.test(value)) categories.add('event')
  if (/\b(familie|medlem|kontakt|telefon|mobil|epost|email|adresse|bursdag|foedselsdag)\b/.test(value)) categories.add('family')
  return categories
}

export function rankAppKnowledge(query: string, data: AppKnowledgeData, now: Date): AppKnowledgeMatch[] {
  const queryTokens = tokenize(query)
  const normalizedQuery = normalize(query)
  const categories = queryCategories(query)
  const queryConcepts = findConcepts(query)
  const querySubjects = findQuerySubjects(query)
  const requestedFacets = queryFacets(query)
  const requestedDates = parseRequestedDateRange(query, now)
  const scored = buildDocuments(data).map((document) => {
    const documentText = normalize(document.searchText)
    const documentTokens = tokenize(document.searchText)
    const documentConcepts = findConcepts(document.searchText)
    const subjectMatch = querySubjects.some((subject) => document.subjects.includes(subject))
    let score = normalizedQuery.length > 4 && documentText.includes(normalizedQuery) ? 14 : 0

    for (const token of queryTokens) {
      const similarity = Math.max(...documentTokens.map((candidate) => tokenSimilarity(token, candidate)), 0)
      if (similarity === 1) score += 4
      else if (similarity >= 0.88) score += 3.5
      else if (similarity >= 0.68) score += 2
    }
    for (const concept of queryConcepts) {
      if (documentConcepts.has(concept)) score += 4
    }
    if (categories.has(document.category)) score += 1.5
    for (const facet of requestedFacets) {
      if (document.facets.includes(facet) && (querySubjects.length === 0 || subjectMatch)) score += 5
    }
    if (subjectMatch) score += 8
    if (requestedDates && document.dateRange && rangesOverlap(requestedDates, document.dateRange)) score += 14
    return { document, score, subjectMatch }
  })

  const bookingIntent = categories.has('booking')
  const overlappingBookings = requestedDates
    ? scored.filter(({ document }) => document.category === 'booking' && document.dateRange && rangesOverlap(requestedDates, document.dateRange))
    : []

  if (bookingIntent && requestedDates && overlappingBookings.length === 0) {
    const month = requestedDates.from.slice(0, 7)
    scored.push({
      score: 20,
      subjectMatch: false,
      document: {
        recordKey: `booking-availability:${requestedDates.from}:${requestedDates.to}`,
        category: 'booking',
        searchText: query,
        subjects: [],
        facets: ['date'],
        context: `Hyttebooking: Ingen bookinger er registrert for ${formatDateRange(requestedDates.from, requestedDates.to)}.`,
        source: { label: 'Hyttekalender', path: `/booking/calendar?month=${month}` },
        dateRange: requestedDates,
      },
    })
  }

  const bestScore = Math.max(...scored.map(({ score }) => score), 0)
  const relativeMinimum = Math.max(6, bestScore * 0.62)
  const seenRecords = new Set<string>()
  return scored
    .filter(({ score, subjectMatch }) => score >= relativeMinimum || (subjectMatch && score >= 7))
    .sort((first, second) => second.score - first.score)
    .map(({ document }) => document)
    .filter((document) => {
      if (seenRecords.has(document.recordKey)) return false
      seenRecords.add(document.recordKey)
      return true
    })
    .slice(0, 4)
    .map(({ context, source }) => ({ context, source }))
}

async function loadAllProfiles() {
  return Promise.all(families.flatMap((family) => (
    family.members.map((member) => readMemberProfile(family.accountId, member.id))
  )))
}

async function safelyLoad<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return await loader()
  } catch {
    return fallback
  }
}

export function createAppKnowledgeRetriever({
  loadGuides = readGuideContent,
  loadPosts = readAllNoticeboardPosts,
  loadComments = readAllNoticeboardComments,
  loadBookings: loadBookingData = readBookings,
  loadEvents = readFamilyEvents,
  loadProfiles = loadAllProfiles,
  now = () => new Date(),
}: Partial<KnowledgeDependencies> = {}) {
  return async function retrieveAppKnowledge(query: string, _familyMember: FamilyMember) {
    const [guides, posts, comments, bookings, events, profiles] = await Promise.all([
      safelyLoad(loadGuides, []),
      safelyLoad(loadPosts, []),
      safelyLoad(loadComments, []),
      safelyLoad(loadBookingData, []),
      safelyLoad(loadEvents, []),
      safelyLoad(loadProfiles, []),
    ])

    return rankAppKnowledge(query, { guides, posts, comments, bookings, events, profiles }, now())
  }
}

export const retrieveAppKnowledge = createAppKnowledgeRetriever()
