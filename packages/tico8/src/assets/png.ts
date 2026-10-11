import type { Palette, Rgb } from '../palette.ts'
import { MAX_COLORS } from '../palette.ts'
import type { IndexedImage } from '../sprites.ts'
import { TRANSPARENT } from '../sprites.ts'

export interface Indexed {
  image: IndexedImage
  /** How many opaque pixels have a colour from outside the palette. */
  offPalette: number
  /** How many of those took a nearby colour because no slot was free. */
  snapped: number
}

/**
 * Turn RGBA pixels into colour indices. A pixel less than half opaque
 * becomes `TRANSPARENT`. A colour not yet in `colors` is added to it, so
 * art keeps the colours it was painted in; once `colors` is full, a new
 * colour takes the nearest one already there.
 *
 * The first `paletteSize` entries of `colors` are the project's palette.
 */
export function indexPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  colors: Rgb[],
  paletteSize = colors.length,
): Indexed {
  if (rgba.length !== width * height * 4) {
    throw new Error(
      `expected ${width * height * 4} RGBA bytes for ${width}x${height}, got ${rgba.length}`,
    )
  }
  const known = new Map<number, number>()
  // Later duplicates must not shadow earlier slots.
  for (let i = colors.length - 1; i >= 0; i--) {
    const [r, g, b] = colors[i] ?? [0, 0, 0]
    known.set((r << 16) | (g << 8) | b, i)
  }
  // Colours that found no free slot, and the nearest slot each one took.
  const full = new Map<number, number>()

  const pixels = new Uint8Array(width * height)
  let offPalette = 0
  let snapped = 0
  for (let i = 0; i < pixels.length; i++) {
    const o = i * 4
    if ((rgba[o + 3] ?? 0) < 128) {
      pixels[i] = TRANSPARENT
      continue
    }
    const r = rgba[o] ?? 0
    const g = rgba[o + 1] ?? 0
    const b = rgba[o + 2] ?? 0
    const key = (r << 16) | (g << 8) | b
    let index = known.get(key)
    if (index === undefined && colors.length < MAX_COLORS) {
      index = colors.push([r, g, b]) - 1
      known.set(key, index)
    }
    if (index === undefined) {
      index = full.get(key)
      if (index === undefined) {
        index = nearest(r, g, b, colors)
        full.set(key, index)
      }
      snapped++
    }
    pixels[i] = index
    if (index >= paletteSize || full.has(key)) offPalette++
  }
  return { image: { width, height, pixels }, offPalette, snapped }
}

/** The index of the nearest colour; ties go to the lower index. */
function nearest(r: number, g: number, b: number, colors: Palette): number {
  let best = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < colors.length; i++) {
    const [pr, pg, pb] = colors[i] ?? [0, 0, 0]
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

/** Fetch a PNG and decode it to RGBA, exactly as stored. Browser only. */
export async function loadPixels(url: string): Promise<ImageData> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `could not load ${url}: ${response.status} ${response.statusText}`,
    )
  }
  const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  })
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(`could not decode ${url}: no 2d context`)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
