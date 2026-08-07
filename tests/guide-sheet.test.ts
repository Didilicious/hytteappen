import { describe, expect, it } from 'vitest'
import {
  GuideSheetConfigurationError,
  normalizeGuideSheet,
  parseAnswerRequirements,
} from '../netlify/functions/_shared/guide-sheet.mts'
import type { GuideContentId } from '../shared/guideContent'

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

function normalize(rows: Row[], allowedIds: GuideContentId[] = ['strom']) {
  return normalizeGuideSheet(makeCsv(rows), allowedIds, (name) => (
    name === 'KEY_BOX_CODE' ? 'TESTKODE' : undefined
  ))
}

describe('normalizeGuideSheet', () => {
  it('matches published rows by code-defined content ID and ignores unknown IDs', () => {
    const result = normalize([
      publishedRow(),
      publishedRow({ ID: 'ukjent-side', 'Tittel / Spørsmål': 'Skal ignoreres' }),
    ])

    expect(result.strom.title).toBe('Slå på strømmen')
    expect(result).not.toHaveProperty('ukjent-side')
  })

  it('uses only Publisert JA rows', () => {
    const result = normalize([
      publishedRow({ Publisert: 'NEI', 'Tittel / Spørsmål': 'Gammel tekst' }),
      publishedRow({ 'Tittel / Spørsmål': 'Publisert tekst' }),
    ])

    expect(result.strom.title).toBe('Publisert tekst')
  })

  it('normalizes blank optional sections as null', () => {
    const content = normalize([publishedRow()]).strom

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
    ]).strom

    expect(content.instructions).toEqual(['Første punkt', 'Andre punkt', 'Tredje punkt'])
  })

  it('parses multiple Guide values', () => {
    const content = normalize([publishedRow({ Guide: 'Åpne, Stenge, Drift' })]).strom
    expect(content.guides).toEqual(['Åpne', 'Stenge', 'Drift'])
  })

  it('parses multiple Krever svar expressions', () => {
    expect(parseAnswerRequirements('aarstid="Vinter", modus="Rolig"')).toEqual([
      { questionId: 'aarstid', answer: 'Vinter' },
      { questionId: 'modus', answer: 'Rolig' },
    ])
  })

  it('treats blank Kan hoppes over as true', () => {
    expect(normalize([publishedRow({ 'Kan hoppes over': '' })]).strom.canSkip).toBe(true)
    expect(normalize([publishedRow({ 'Kan hoppes over': 'NEI' })]).strom.canSkip).toBe(false)
  })

  it('replaces secure placeholders without exposing the placeholder token', () => {
    const content = normalize([
      publishedRow({
        'Instruksjoner (én linje = ett punkt)': 'Bruk koden {{KEY_BOX_CODE}}.',
      }),
    ]).strom

    expect(content.instructions).toEqual(['Bruk koden TESTKODE.'])
    expect(JSON.stringify(content)).not.toContain('KEY_BOX_CODE')
  })

  it('rejects malformed requirements and IDs', () => {
    expect(() => parseAnswerRequirements('aarstid=Vinter')).toThrow(GuideSheetConfigurationError)
    expect(() => normalize([publishedRow({ ID: 'Ugyldig ID' })])).toThrow(GuideSheetConfigurationError)
  })

  it('rejects duplicate published IDs', () => {
    expect(() => normalize([publishedRow(), publishedRow()])).toThrow(GuideSheetConfigurationError)
  })

  it('rejects missing published rows for code-defined pages', () => {
    expect(() => normalizeGuideSheet(makeCsv([]), ['strom'], () => undefined))
      .toThrow(GuideSheetConfigurationError)
  })
})
