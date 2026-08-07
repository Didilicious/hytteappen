import type { GuideContent } from '../../shared/guideContent'

export type GuideImage = {
  src: string
  alt: string
}

export function GuideImageSection({ images = [] }: { images?: readonly GuideImage[] }) {
  if (images.length === 0) return null

  return (
    <section className="guide-images" aria-label="Bilder til steget">
      {images.map((image) => (
        <img key={image.src} src={image.src} alt={image.alt} />
      ))}
    </section>
  )
}

export default function GuideContentSections({
  content,
  images = [],
}: {
  content: GuideContent
  images?: readonly GuideImage[]
}) {
  const hasMainGuide = Boolean(content.location || content.instructions.length > 0)
  const hasContent = Boolean(content.warning || images.length > 0 || hasMainGuide || content.checkpoints)

  if (!hasContent) return null

  return (
    <div className="guide-sections">
      {content.warning && (
        <section className="guide-compact-card guide-warning-card">
          <h2>Viktig</h2>
          <p>{content.warning}</p>
        </section>
      )}

      <GuideImageSection images={images} />

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
