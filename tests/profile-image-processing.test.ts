// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROFILE_IMAGE_MAX_BYTES } from '../src/profileImages'
import {
  PROFILE_IMAGE_OUTPUT_SIZE,
  PROFILE_IMAGE_SOURCE_MAX_BYTES,
  calculateCropArea,
  createCroppedProfileImage,
  validateProfileImageSource,
} from '../src/profileImageProcessing'

describe('profile image browser processing', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts a valid source image larger than the server upload limit', () => {
    const source = new File(
      [new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1024)],
      'telefonbilde.jpg',
      { type: 'image/jpeg' },
    )

    expect(() => validateProfileImageSource(source)).not.toThrow()
  })

  it('retains a separate source safety limit', () => {
    const source = new File(
      [new Uint8Array(PROFILE_IMAGE_SOURCE_MAX_BYTES + 1)],
      'for-stort.jpg',
      { type: 'image/jpeg' },
    )

    expect(() => validateProfileImageSource(source)).toThrow('under 30 MB')
  })

  it('always calculates a square crop inside the source image', () => {
    const crop = calculateCropArea(4032, 3024, 320, 1.7, { x: 84, y: -36 })

    expect(crop.width).toBeCloseTo(crop.height)
    expect(crop.x).toBeGreaterThanOrEqual(0)
    expect(crop.y).toBeGreaterThanOrEqual(0)
    expect(crop.x + crop.width).toBeLessThanOrEqual(4032)
    expect(crop.y + crop.height).toBeLessThanOrEqual(3024)
  })

  it('exports square WebP and retries compression below the upload limit', async () => {
    const drawImage = vi.fn()
    const toBlob = vi.fn()
      .mockImplementationOnce((callback: (blob: Blob) => void) => callback(
        new Blob([new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1)], { type: 'image/webp' }),
      ))
      .mockImplementationOnce((callback: (blob: Blob) => void) => callback(
        new Blob([new Uint8Array(240_000)], { type: 'image/webp' }),
      ))
    const canvases: Array<{ width: number; height: number }> = []
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName)
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage,
          imageSmoothingEnabled: false,
          imageSmoothingQuality: 'low',
        }),
        toBlob,
      }
      canvases.push(canvas)
      return canvas
    }) as typeof document.createElement)

    const result = await createCroppedProfileImage(
      document.createElement('img'),
      { x: 100, y: 200, width: 1600, height: 1600 },
    )

    expect(result.type).toBe('image/webp')
    expect(result.size).toBeLessThan(PROFILE_IMAGE_MAX_BYTES)
    expect(canvases).toHaveLength(2)
    expect(canvases[0]).toMatchObject({ width: PROFILE_IMAGE_OUTPUT_SIZE, height: PROFILE_IMAGE_OUTPUT_SIZE })
    expect(canvases[1]).toMatchObject({ width: PROFILE_IMAGE_OUTPUT_SIZE, height: PROFILE_IMAGE_OUTPUT_SIZE })
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      100,
      200,
      1600,
      1600,
      0,
      0,
      PROFILE_IMAGE_OUTPUT_SIZE,
      PROFILE_IMAGE_OUTPUT_SIZE,
    )
  })
})
