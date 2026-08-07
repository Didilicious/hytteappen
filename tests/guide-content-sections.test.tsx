import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import GuideContentSections from '../src/components/GuideContentSections'

const baseContent: GuideContent = {
  id: 'nokkelboks',
  guides: ['Åpne'],
  type: 'step',
  afterId: null,
  requiredStepIds: [],
  answerRequirements: [],
  title: 'Hent nøkkelen',
  location: null,
  warning: null,
  instructions: [],
  checkpoints: null,
  answerOptions: [],
  canSkip: true,
  imageGroup: null,
}

describe('GuideContentSections', () => {
  it('renders warning, main guide, and checkpoint cards in guide order', () => {
    const markup = renderToStaticMarkup(
      <GuideContentSections
        content={{
          ...baseContent,
          warning: 'Legg nøkkelen tilbake.',
          location: 'Ved inngangsdøren',
          instructions: ['Åpne kodeboksen.', 'Ta ut nøkkelen.'],
          checkpoints: 'Kodeboksen er låst.',
        }}
      />,
    )

    expect(markup.indexOf('guide-warning-card')).toBeLessThan(markup.indexOf('guide-main-card'))
    expect(markup.indexOf('guide-main-card')).toBeLessThan(markup.indexOf('guide-checkpoint-card'))
    expect(markup).toContain('<h2>Sted</h2>')
    expect(markup).not.toContain('Instruksjoner')
  })

  it('omits blank optional sections and places instructions first in the main card', () => {
    const markup = renderToStaticMarkup(
      <GuideContentSections content={{ ...baseContent, instructions: ['Første steg.'] }} />,
    )

    expect(markup).not.toContain('guide-warning-card')
    expect(markup).not.toContain('guide-main-card__location')
    expect(markup).not.toContain('guide-checkpoint-card')
    expect(markup).toContain('<ol class="guide-main-card__steps">')
  })

  it('renders the image section only when image data is supplied', () => {
    const emptyMarkup = renderToStaticMarkup(<GuideContentSections content={baseContent} />)
    const imageMarkup = renderToStaticMarkup(
      <GuideContentSections
        content={baseContent}
        images={[{ src: '/test-image.jpg', alt: 'Nøkkelboksen ved døren' }]}
      />,
    )

    expect(emptyMarkup).not.toContain('guide-images')
    expect(imageMarkup).toContain('guide-images')
    expect(imageMarkup).toContain('alt="Nøkkelboksen ved døren"')
  })
})
