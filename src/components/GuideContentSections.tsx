import { useEffect, useRef, useState } from 'react'
import type { GuideContent } from '../../shared/guideContent'
import type { GuideImage } from '../../shared/guideImages'
import type { GuideImagesLoadState } from '../guideImages'

export function GuideImageCarousel({ images, title }: { images: readonly GuideImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const imageCount = images.length

  useEffect(() => setActiveIndex(0), [images])

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + imageCount) % imageCount)
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % imageCount)
  }

  if (imageCount === 0) return null

  return (
    <section className="guide-images" aria-label="Bilder til steget">
      <div
        className="guide-carousel"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const startX = touchStartX.current
          const endX = event.changedTouches[0]?.clientX
          touchStartX.current = null

          if (startX === null || endX === undefined || Math.abs(startX - endX) < 40) return
          if (startX > endX) showNext()
          else showPrevious()
        }}
      >
        <div
          className="guide-carousel__track"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div className="guide-carousel__slide" key={image.src} aria-hidden={index !== activeIndex}>
              <img
                src={image.src}
                alt={`${title} – bilde ${index + 1} av ${imageCount}`}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>

        {imageCount > 1 && (
          <>
            <button
              className="guide-carousel__button guide-carousel__button--previous"
              type="button"
              aria-label="Forrige bilde"
              onClick={showPrevious}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              className="guide-carousel__button guide-carousel__button--next"
              type="button"
              aria-label="Neste bilde"
              onClick={showNext}
            >
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </div>

      {imageCount > 1 && (
        <div className="guide-carousel__position">
          <div className="guide-carousel__dots" aria-hidden="true">
            {images.map((image, index) => (
              <span
                className={`guide-carousel__dot${index === activeIndex ? ' guide-carousel__dot--active' : ''}`}
                key={image.src}
              />
            ))}
          </div>
          <span className="visually-hidden" aria-live="polite">
            Bilde {activeIndex + 1} av {imageCount}
          </span>
        </div>
      )}
    </section>
  )
}

export function GuideImageSection({
  content,
  imageState,
}: {
  content: GuideContent
  imageState: GuideImagesLoadState
}) {
  const imageGroup = content.imageGroup?.trim()
  if (!imageGroup) return null

  if (imageState.status === 'loading') {
    return <p className="guide-image-message" role="status">Henter bilder …</p>
  }

  if (imageState.status === 'error') {
    return (
      <p className="guide-image-message guide-image-message--error" role="status">
        Kunne ikke laste bilder fra Google Drive.
      </p>
    )
  }

  const images = imageState.imagesByGroup[imageGroup] ?? []
  if (images.length === 0) {
    return (
      <p className="guide-image-message guide-image-message--warning" role="status">
        Fant ingen bilder for bildegruppen &quot;{imageGroup}&quot;.
      </p>
    )
  }

  return <GuideImageCarousel images={images} title={content.title} />
}

export default function GuideContentSections({
  content,
  imageState = { status: 'loaded', imagesByGroup: {} },
}: {
  content: GuideContent
  imageState?: GuideImagesLoadState
}) {
  const hasMainGuide = Boolean(content.location || content.instructions.length > 0)
  const hasContent = Boolean(content.warning || content.imageGroup || hasMainGuide || content.checkpoints)

  if (!hasContent) return null

  return (
    <div className="guide-sections">
      {content.warning && (
        <section className="guide-compact-card guide-warning-card">
          <h2>Viktig</h2>
          <p>{content.warning}</p>
        </section>
      )}

      <GuideImageSection content={content} imageState={imageState} />

      {hasMainGuide && (
        <section className="guide-main-card" aria-label="Veiledning">
          {content.location && (
            <div className="guide-main-card__location">
              <h2>Sted</h2>
              <p>{content.location}</p>
            </div>
          )}

          {content.instructions.length > 0 && (
            <ol className="guide-main-card__steps">
              {content.instructions.map((instruction, index) => (
                <li key={`${index}-${instruction}`}>{instruction}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {content.checkpoints && (
        <section className="guide-compact-card guide-checkpoint-card">
          <h2>Kontroller etterpå</h2>
          <p>{content.checkpoints}</p>
        </section>
      )}
    </div>
  )
}
