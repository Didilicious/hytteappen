import { describe, expect, it } from 'vitest'
import {
  GuideSheetConfigurationError,
  normalizeGuideSheet,
  parseAnswerRequirements,
} from '../netlify/functions/_shared/guide-sheet.mts'

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
  'Kommentar',
]

type Row = Partial<Record<typeof headers[number], string>>

function csvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function makeCsv(rows: Row[]) {
  return [
    'Vises ikke i appen,,,,,,Vises i appen',
    headers.map(csvValue).join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header] ?? '')).join(',')),
  ].join('\n')
}

function publishedRow(overrides: Row = {}): Row {
  return {
    ID: 'strom',
    Guide: 'Åpne',
    Type: 'Steg',
    'Tittel / Spørsmål': 'Slå på strømmen',
    Publisert: 'JA',
    ...overrides,
  }
}

function normalize(rows: Row[], warnings: string[] = []) {
  return normalizeGuideSheet(makeCsv(rows), (name) => (
    name === 'KEY_BOX_CODE' ? 'TESTKODE' : undefined
  ), (warning) => warnings.push(warning))
}

describe('normalizeGuideSheet', () => {
  it('turns every published row into content without code-defined IDs', () => {
    const result = normalize([
      publishedRow(),
      publishedRow({ ID: 'ny-side', Type: 'Spørsmål', 'Tittel / Spørsmål': 'Nytt spørsmål' }),
    ])

    expect(result.map((item) => item.id)).toEqual(['strom', 'ny-side'])
    expect(result[1]).toMatchObject({ type: 'question', title: 'Nytt spørsmål' })
  })

  it('uses only Publisert JA rows', () => {
    const result = normalize([
      publishedRow({ Publisert: 'NEI', 'Tittel / Spørsmål': 'Gammel tekst' }),
      publishedRow({ 'Tittel / Spørsmål': 'Publisert tekst' }),
    ])

    expect(result[0].title).toBe('Publisert tekst')
  })

  it('normalizes blank optional sections as null', () => {
    const content = normalize([publishedRow()])[0]

    expect(content.location).toBeNull()
    expect(content.warning).toBeNull()
    expect(content.checkpoints).toBeNull()
    expect(content.imageGroup).toBeNull()
  })

  it('splits multiline instructions, trims whitespace, and preserves order', () => {
    const content = normalize([
      publishedRow({
        'Instruksjoner (én linje = ett punkt)': ' Første punkt \n\n Andre punkt\nTredje punkt ',
      }),
    ])[0]

    expect(content.instructions).toEqual(['Første punkt', 'Andre punkt', 'Tredje punkt'])
  })

  it('parses multiple Guide values', () => {
    const content = normalize([publishedRow({ Guide: 'Åpne, Stenge, Drift' })])[0]
    expect(content.guides).toEqual(['Åpne', 'Stenge', 'Drift'])
  })

  it('parses multiple Krever svar expressions', () => {
    expect(parseAnswerRequirements('aarstid="Vinter", modus="Rolig"')).toEqual([
      { questionId: 'aarstid', answer: 'Vinter' },
      { questionId: 'modus', answer: 'Rolig' },
    ])
  })

  it('treats blank Kan hoppes over as true', () => {
    expect(normalize([publishedRow({ 'Kan hoppes over': '' })])[0].canSkip).toBe(true)
    expect(normalize([publishedRow({ 'Kan hoppes over': 'NEI' })])[0].canSkip).toBe(false)
  })

  it('replaces secure placeholders without exposing the placeholder token', () => {
    const content = normalize([
      publishedRow({
        'Instruksjoner (én linje = ett punkt)': 'Bruk koden {{KEY_BOX_CODE}}.',
      }),
    ])[0]

    expect(content.instructions).toEqual(['Bruk koden TESTKODE.'])
    expect(JSON.stringify(content)).not.toContain('KEY_BOX_CODE')
  })

  it('logs and safely ignores malformed requirements and IDs', () => {
    const warnings: string[] = []
    expect(() => parseAnswerRequirements('aarstid=Vinter')).toThrow(GuideSheetConfigurationError)
    const content = normalize([
      publishedRow({ 'Krever svar': 'aarstid=Vinter' }),
      publishedRow({ ID: 'Ugyldig ID' }),
    ], warnings)

    expect(content).toHaveLength(1)
    expect(content[0].answerRequirements).toEqual([])
    expect(warnings).toHaveLength(2)
  })

  it('keeps the first duplicate published ID and logs a warning', () => {
    const warnings: string[] = []
    const content = normalize([publishedRow(), publishedRow()], warnings)

    expect(content).toHaveLength(1)
    expect(warnings[0]).toContain('duplicate')
  })
})
