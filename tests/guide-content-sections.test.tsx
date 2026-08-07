// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { GuideContent } from '../shared/guideContent'
import GuideContentSections from '../src/components/GuideContentSections'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
  let mountedRoot: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    if (mountedRoot) {
      act(() => mountedRoot?.unmount())
      mountedRoot = undefined
    }
    document.body.innerHTML = ''
  })

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

  it('renders no image section or warning for a blank image group', () => {
    const emptyMarkup = renderToStaticMarkup(<GuideContentSections content={baseContent} />)

    expect(emptyMarkup).not.toContain('guide-images')
    expect(emptyMarkup).not.toContain('Fant ingen bilder')
  })

  it('renders one matching image without carousel controls', () => {
    const imageMarkup = renderToStaticMarkup(
      <GuideContentSections
        content={{ ...baseContent, imageGroup: 'test' }}
        imageState={{
          status: 'loaded',
          imagesByGroup: { test: [{ name: 'test-1.jpg', src: '/test-image.jpg' }] },
        }}
      />,
    )

    expect(imageMarkup).toContain('guide-images')
    expect(imageMarkup).toContain('alt="Hent nøkkelen – bilde 1 av 1"')
    expect(imageMarkup).not.toContain('Forrige bilde')
    expect(imageMarkup).not.toContain('Neste bilde')
  })

  it('places image feedback after the warning and before the main guide', () => {
    const markup = renderToStaticMarkup(
      <GuideContentSections
        content={{
          ...baseContent,
          warning: 'Vær forsiktig.',
          instructions: ['Utfør steget.'],
          imageGroup: 'mangler',
        }}
        imageState={{ status: 'loaded', imagesByGroup: { mangler: [] } }}
      />,
    )

    expect(markup).toContain('Fant ingen bilder for bildegruppen &quot;mangler&quot;.')
    expect(markup.indexOf('guide-warning-card')).toBeLessThan(markup.indexOf('guide-image-message'))
    expect(markup.indexOf('guide-image-message')).toBeLessThan(markup.indexOf('guide-main-card'))
  })

  it('shows a small image error without hiding guide content', () => {
    const markup = renderToStaticMarkup(
      <GuideContentSections
        content={{ ...baseContent, imageGroup: 'test', instructions: ['Fortsett guiden.'] }}
        imageState={{ status: 'error' }}
      />,
    )

    expect(markup).toContain('Kunne ikke laste bilder fra Google Drive.')
    expect(markup).toContain('Fortsett guiden.')
  })

  it('navigates the carousel and exposes Norwegian accessible labels', () => {
    const container = document.createElement('div')
    document.body.append(container)
    mountedRoot = createRoot(container)

    act(() => {
      mountedRoot?.render(
        <GuideContentSections
          content={{ ...baseContent, imageGroup: 'test' }}
          imageState={{
            status: 'loaded',
            imagesByGroup: {
              test: [
                { name: 'test-1.jpg', src: '/test-1.jpg' },
                { name: 'test-2.jpg', src: '/test-2.jpg' },
              ],
            },
          }}
        />,
      )
    })

    const previousButton = container.querySelector<HTMLButtonElement>('[aria-label="Forrige bilde"]')
    const nextButton = container.querySelector<HTMLButtonElement>('[aria-label="Neste bilde"]')
    const track = container.querySelector<HTMLElement>('.guide-carousel__track')

    expect(previousButton?.type).toBe('button')
    expect(nextButton?.type).toBe('button')
    expect(track?.style.transform).toBe('translateX(-0%)')
    expect(container.textContent).toContain('Bilde 1 av 2')

    act(() => nextButton?.click())

    expect(track?.style.transform).toBe('translateX(-100%)')
    expect(container.textContent).toContain('Bilde 2 av 2')

    act(() => previousButton?.click())

    expect(track?.style.transform).toBe('translateX(-0%)')
  })
})
