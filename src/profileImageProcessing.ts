import { PROFILE_IMAGE_MAX_BYTES } from './profileImages'

export const PROFILE_IMAGE_OUTPUT_SIZE = 1200
export const PROFILE_IMAGE_SOURCE_MAX_BYTES = 30 * 1024 * 1024
export const PROFILE_IMAGE_SOURCE_MAX_PIXELS = 50_000_000

export type CropPosition = {
  x: number
  y: number
}

export type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

export type LoadedProfileImage = {
  image: HTMLImageElement
  url: string
  width: number
  height: number
  dispose: () => void
}

const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateProfileImageSource(file: File) {
  if (!supportedTypes.has(file.type)) {
    throw new Error('Filtypen støttes ikke. Bruk JPEG, PNG eller WebP.')
  }

  if (file.size > PROFILE_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error('Bildet er for stort til å behandles trygt. Velg et bilde under 30 MB.')
  }
}

export async function loadProfileImageSource(file: File): Promise<LoadedProfileImage> {
  validateProfileImageSource(file)

  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url

  try {
    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('DECODE_FAILED'))
      })
    }

    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height || width * height > PROFILE_IMAGE_SOURCE_MAX_PIXELS) {
      throw new Error('Bildet har for høy oppløsning til å behandles trygt. Velg et mindre bilde.')
    }

    return {
      image,
      url,
      width,
      height,
      dispose: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    if (error instanceof Error && error.message.includes('for høy oppløsning')) throw error
    throw new Error('Bildet kunne ikke åpnes eller behandles. Velg en annen bildefil.')
  }
}

function getBaseScale(imageWidth: number, imageHeight: number, viewportSize: number) {
  return Math.max(viewportSize / imageWidth, viewportSize / imageHeight)
}

export function clampCropPosition(
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
  zoom: number,
  position: CropPosition,
): CropPosition {
  const scale = getBaseScale(imageWidth, imageHeight, viewportSize) * zoom
  const maxX = Math.max(0, (imageWidth * scale - viewportSize) / 2)
  const maxY = Math.max(0, (imageHeight * scale - viewportSize) / 2)

  return {
    x: Math.max(-maxX, Math.min(maxX, position.x)),
    y: Math.max(-maxY, Math.min(maxY, position.y)),
  }
}

export function calculateCropArea(
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
  zoom: number,
  position: CropPosition,
): CropArea {
  const scale = getBaseScale(imageWidth, imageHeight, viewportSize) * zoom
  const cropSize = viewportSize / scale
  const clampedPosition = clampCropPosition(imageWidth, imageHeight, viewportSize, zoom, position)

  return {
    x: Math.max(0, Math.min(imageWidth - cropSize, (imageWidth - cropSize) / 2 - clampedPosition.x / scale)),
    y: Math.max(0, Math.min(imageHeight - cropSize, (imageHeight - cropSize) / 2 - clampedPosition.y / scale)),
    width: cropSize,
    height: cropSize,
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('ENCODE_FAILED'))
    }, type, quality)
  })
}

export async function createCroppedProfileImage(image: HTMLImageElement, crop: CropArea) {
  const attempts = [
    { size: PROFILE_IMAGE_OUTPUT_SIZE, quality: 0.86 },
    { size: PROFILE_IMAGE_OUTPUT_SIZE, quality: 0.76 },
    { size: 1000, quality: 0.72 },
    { size: 900, quality: 0.66 },
  ]

  for (const attempt of attempts) {
    const canvas = document.createElement('canvas')
    canvas.width = attempt.size
    canvas.height = attempt.size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Bildet kunne ikke behandles i denne nettleseren.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      attempt.size,
      attempt.size,
    )

    let blob = await canvasToBlob(canvas, 'image/webp', attempt.quality)
    if (blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', attempt.quality)
    }
    if (blob.size <= PROFILE_IMAGE_MAX_BYTES) {
      const type = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
      const extension = type === 'image/webp' ? 'webp' : 'jpg'
      return new File([blob], `profilbilde.${extension}`, { type })
    }
  }

  throw new Error('Bildet kunne ikke komprimeres nok. Prøv et annet utsnitt eller bilde.')
}
