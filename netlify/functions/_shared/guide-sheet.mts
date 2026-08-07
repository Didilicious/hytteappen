import type {
  AnswerRequirement,
  GuideContent,
  GuideContentId,
  GuideName,
  SheetNodeType,
} from '../../../shared/guideContent.ts'

const COLUMN = {
  id: 'ID',
  guides: 'Guide',
  type: 'Type',
  after: 'Etter',
  requiredSteps: 'Krever steg',
  answerRequirements: 'Krever svar',
  title: 'Tittel / Spørsmål',
  location: 'Sted',
  warning: 'Advarsler / viktige påminnelser',
  instructions: 'Instruksjoner (én linje = ett punkt)',
  checkpoints: 'Hva bør kontrolleres etterpå?',
  answerOptions: 'Svaralternativer',
  canSkip: 'Kan hoppes over',
  imageGroup: 'Bildegruppe',
  published: 'Publisert',
} as const

const requiredColumns = Object.values(COLUMN)
const validGuides = new Set<GuideName>(['Åpne', 'Stenge', 'Drift'])
const validIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const placeholderPattern = /{{([A-Z][A-Z0-9_]*)}}/g

export class GuideSheetConfigurationError extends Error {}

export function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        value += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(value)
      value = ''
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''))
      rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (quoted) {
    throw new GuideSheetConfigurationError('CSV contains an unterminated quoted value.')
  }

  if (value || row.length > 0) {
    row.push(value.replace(/\r$/, ''))
    rows.push(row)
  }

  return rows
}

function splitValues(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitRequirements(value: string) {
  const expressions: string[] = []
  let expression = ''
  let quoted = false

  for (const character of value) {
    if (character === '"') quoted = !quoted

    if (character === ',' && !quoted) {
      expressions.push(expression.trim())
      expression = ''
    } else {
      expression += character
    }
  }

  if (quoted) {
    throw new GuideSheetConfigurationError('Malformed answer requirement.')
  }

  if (expression.trim()) expressions.push(expression.trim())
  return expressions.filter(Boolean)
}

export function parseAnswerRequirements(value: string): AnswerRequirement[] {
  if (!value.trim()) return []

  return splitRequirements(value).map((expression) => {
    const match = expression.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\s*=\s*"([^"]+)"$/)
    if (!match) {
      throw new GuideSheetConfigurationError('Malformed answer requirement.')
    }

    return { questionId: match[1], answer: match[2].trim() }
  })
}

function replacePlaceholders(value: string, resolveEnvironmentValue: (name: string) => string | undefined) {
  return value.replace(placeholderPattern, (_placeholder, name: string) => {
    const replacement = resolveEnvironmentValue(name)
    if (!replacement) {
      throw new GuideSheetConfigurationError('A secure placeholder is not configured.')
    }
    return replacement
  })
}

function optionalText(value: string, resolveEnvironmentValue: (name: string) => string | undefined) {
  const trimmed = value.trim()
  return trimmed ? replacePlaceholders(trimmed, resolveEnvironmentValue) : null
}

function parseGuides(value: string) {
  const guides = splitValues(value)
  if (guides.some((guide) => !validGuides.has(guide as GuideName))) {
    throw new GuideSheetConfigurationError('A row contains an unsupported guide value.')
  }
  return guides as GuideName[]
}

function parseType(value: string): SheetNodeType {
  if (value.trim() === 'Steg') return 'step'
  if (value.trim() === 'Spørsmål') return 'question'
  throw new GuideSheetConfigurationError('A row contains an unsupported page type.')
}

function parseCanSkip(value: string) {
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized === 'JA') return true
  if (normalized === 'NEI') return false
  throw new GuideSheetConfigurationError('A row contains an unsupported skip value.')
}

export function normalizeGuideSheet(
  csv: string,
  allowedIds: readonly GuideContentId[],
  resolveEnvironmentValue: (name: string) => string | undefined,
) {
  const rows = parseCsv(csv)
  const headerIndex = rows.findIndex((row) => row.includes(COLUMN.id) && row.includes(COLUMN.title))

  if (headerIndex < 0) {
    throw new GuideSheetConfigurationError('The guide sheet header is missing.')
  }

  const headers = rows[headerIndex].map((header) => header.trim())
  for (const column of requiredColumns) {
    if (!headers.includes(column)) {
      throw new GuideSheetConfigurationError('The guide sheet is missing a required column.')
    }
  }

  const allowedIdSet = new Set(allowedIds)
  const contentById = {} as Record<GuideContentId, GuideContent>

  for (const row of rows.slice(headerIndex + 1)) {
    const values = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
    if (values[COLUMN.published].trim().toUpperCase() !== 'JA') continue

    const id = values[COLUMN.id].trim()
    if (!validIdPattern.test(id)) {
      throw new GuideSheetConfigurationError('A published row has a malformed ID.')
    }
    if (!allowedIdSet.has(id as GuideContentId)) continue
    if (contentById[id as GuideContentId]) {
      throw new GuideSheetConfigurationError('The guide sheet contains a duplicate ID.')
    }

    const instructions = values[COLUMN.instructions]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => replacePlaceholders(line, resolveEnvironmentValue))
    const answerOptions = splitValues(values[COLUMN.answerOptions])
      .map((option) => replacePlaceholders(option, resolveEnvironmentValue))

    contentById[id as GuideContentId] = {
      id: id as GuideContentId,
      guides: parseGuides(values[COLUMN.guides]),
      type: parseType(values[COLUMN.type]),
      afterId: values[COLUMN.after].trim() || null,
      requiredStepIds: splitValues(values[COLUMN.requiredSteps]),
      answerRequirements: parseAnswerRequirements(values[COLUMN.answerRequirements]),
      title: replacePlaceholders(values[COLUMN.title].trim(), resolveEnvironmentValue),
      location: optionalText(values[COLUMN.location], resolveEnvironmentValue),
      warning: optionalText(values[COLUMN.warning], resolveEnvironmentValue),
      instructions,
      checkpoints: optionalText(values[COLUMN.checkpoints], resolveEnvironmentValue),
      answerOptions,
      canSkip: parseCanSkip(values[COLUMN.canSkip]),
      imageGroup: optionalText(values[COLUMN.imageGroup], resolveEnvironmentValue),
    }
  }

  for (const id of allowedIds) {
    if (!contentById[id]) {
      throw new GuideSheetConfigurationError('A code-defined guide page has no published row.')
    }
  }

  return contentById
}
