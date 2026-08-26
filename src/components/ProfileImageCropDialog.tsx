import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import {
  calculateCropArea,
  clampCropPosition,
  createCroppedProfileImage,
  loadProfileImageSource,
  type CropPosition,
  type LoadedProfileImage,
} from '../profileImageProcessing'

type ProfileImageCropDialogProps = {
  file: File
  onCancel: () => void
  onApply: (image: File) => Promise<void>
}

type PointerPoint = { x: number; y: number }

type Gesture = {
  type: 'drag' | 'pinch'
  startPosition: CropPosition
  startZoom: number
  startPoint?: PointerPoint
  startCenter?: PointerPoint
  startDistance?: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const FALLBACK_VIEWPORT_SIZE = 320

function pointDistance(first: PointerPoint, second: PointerPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function pointCenter(first: PointerPoint, second: PointerPoint) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

export default function ProfileImageCropDialog({ file, onCancel, onApply }: ProfileImageCropDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef(new Map<number, PointerPoint>())
  const gestureRef = useRef<Gesture | null>(null)
  const [source, setSource] = useState<LoadedProfileImage | null>(null)
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [viewportSize, setViewportSize] = useState(FALLBACK_VIEWPORT_SIZE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
      previousFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    let active = true
    let loadedSource: LoadedProfileImage | null = null
    setError(null)

    void loadProfileImageSource(file)
      .then((nextSource) => {
        loadedSource = nextSource
        if (active) setSource(nextSource)
        else nextSource.dispose()
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Bildet kunne ikke åpnes. Velg et annet bilde.')
        }
      })

    return () => {
      active = false
      loadedSource?.dispose()
    }
  }, [file])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateSize = () => {
      const size = viewport.getBoundingClientRect().width
      if (size > 0) setViewportSize(size)
    }
    updateSize()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [source])

  function updatePosition(nextPosition: CropPosition, nextZoom = zoom) {
    if (!source) return
    setPosition(clampCropPosition(source.width, source.height, viewportSize, nextZoom, nextPosition))
  }

  function updateZoom(nextZoom: number) {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    setZoom(clampedZoom)
    if (source) {
      setPosition((current) => clampCropPosition(
        source.width,
        source.height,
        viewportSize,
        clampedZoom,
        current,
      ))
    }
  }

  function startGesture() {
    const points = [...pointersRef.current.values()]
    if (points.length >= 2) {
      gestureRef.current = {
        type: 'pinch',
        startPosition: position,
        startZoom: zoom,
        startCenter: pointCenter(points[0], points[1]),
        startDistance: pointDistance(points[0], points[1]),
      }
    } else if (points.length === 1) {
      gestureRef.current = {
        type: 'drag',
        startPosition: position,
        startZoom: zoom,
        startPoint: points[0],
      }
    } else {
      gestureRef.current = null
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!source || busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    startGesture()
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId) || !source || busy) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    const points = [...pointersRef.current.values()]

    if (gesture?.type === 'pinch' && points.length >= 2 && gesture.startCenter && gesture.startDistance) {
      const center = pointCenter(points[0], points[1])
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, gesture.startZoom * pointDistance(points[0], points[1]) / gesture.startDistance),
      )
      setZoom(nextZoom)
      updatePosition({
        x: gesture.startPosition.x + center.x - gesture.startCenter.x,
        y: gesture.startPosition.y + center.y - gesture.startCenter.y,
      }, nextZoom)
    } else if (gesture?.type === 'drag' && points.length === 1 && gesture.startPoint) {
      updatePosition({
        x: gesture.startPosition.x + points[0].x - gesture.startPoint.x,
        y: gesture.startPosition.y + points[0].y - gesture.startPoint.y,
      })
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    startGesture()
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!source || busy) return
    event.preventDefault()
    updateZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!source || busy) return
    const step = event.shiftKey ? 24 : 10

    if (event.key === 'ArrowLeft') updatePosition({ x: position.x - step, y: position.y })
    else if (event.key === 'ArrowRight') updatePosition({ x: position.x + step, y: position.y })
    else if (event.key === 'ArrowUp') updatePosition({ x: position.x, y: position.y - step })
    else if (event.key === 'ArrowDown') updatePosition({ x: position.x, y: position.y + step })
    else if (event.key === '+' || event.key === '=') updateZoom(zoom + 0.15)
    else if (event.key === '-') updateZoom(zoom - 0.15)
    else return

    event.preventDefault()
  }

  async function handleApply() {
    if (!source || busy) return
    setBusy(true)
    setError(null)

    try {
      const crop = calculateCropArea(source.width, source.height, viewportSize, zoom, position)
      const processedImage = await createCroppedProfileImage(source.image, crop)
      await onApply(processedImage)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Bildet kunne ikke behandles. Prøv igjen.')
      setBusy(false)
    }
  }

  const baseScale = source ? Math.max(viewportSize / source.width, viewportSize / source.height) : 1
  const imageTransform = source
    ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${baseScale * zoom})`
    : undefined

  return (
    <dialog
      ref={dialogRef}
      className="profile-crop-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <div className="profile-crop-dialog__content">
        <p className="eyebrow">Tilpass profilbildet</p>
        <h2 id={titleId}>Velg utsnitt</h2>
        <p id={descriptionId}>Flytt bildet og zoom til ansiktet eller motivet ligger innenfor sirkelen.</p>

        <div
          ref={viewportRef}
          className={`profile-crop-dialog__viewport${source ? ' is-ready' : ''}`}
          role="application"
          aria-label="Bildeutsnitt. Dra for å flytte bildet. Bruk pluss og minus for å zoome."
          tabIndex={source && !busy ? 0 : -1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
        >
          {source && <img src={source.url} alt="" draggable={false} style={{ transform: imageTransform }} />}
          {!source && !error && <span className="profile-crop-dialog__loading">Åpner bildet …</span>}
          <span className="profile-crop-dialog__mask" aria-hidden="true" />
        </div>

        <div className="profile-crop-dialog__zoom" aria-label="Zoom">
          <button type="button" onClick={() => updateZoom(zoom - 0.2)} disabled={!source || busy || zoom <= MIN_ZOOM} aria-label="Zoom ut">−</button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            disabled={!source || busy}
            onChange={(event) => updateZoom(Number(event.target.value))}
            aria-label="Zoomnivå"
          />
          <button type="button" onClick={() => updateZoom(zoom + 0.2)} disabled={!source || busy || zoom >= MAX_ZOOM} aria-label="Zoom inn">+</button>
        </div>

        {error && <p className="profile-crop-dialog__error" role="alert">{error}</p>}

        <div className="profile-crop-dialog__actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Avbryt</button>
          <button type="button" className="primary-button" onClick={() => void handleApply()} disabled={!source || busy}>
            {busy ? 'Laster opp …' : 'Bruk bilde'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
