import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, it, vi } from 'vitest'
import { ready } from '../../tico8/src/assets/sheets.ts'
import { display } from '../../tico8/src/console.ts'
import { picture } from '../../tico8/src/testing.ts'
import { TEMPLATE_DIR } from './create.ts'

// The engine fetches sheets in the browser. Here they are read from the
// template folder instead.
vi.mock('../../tico8/src/assets/png.ts', async (original) => ({
  ...(await original<object>()),
  loadPixels: async (url: string) =>
    decodePng(readFileSync(join(TEMPLATE_DIR, url))),
}))

/** An 8-bit RGBA PNG's pixels, as the browser would decode them. */
function decodePng(file: Buffer) {
  const width = file.readUInt32BE(16)
  const height = file.readUInt32BE(20)
  const parts: Buffer[] = []
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at)
    if (file.toString('latin1', at + 4, at + 8) === 'IDAT') {
      parts.push(file.subarray(at + 8, at + 8 + length))
    }
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * 4
  const data = new Uint8ClampedArray(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x
      const a = x >= 4 ? data[at - 4]! : 0
      const b = y > 0 ? data[at - stride]! : 0
      const c = x >= 4 && y > 0 ? data[at - stride - 4]! : 0
      const p = a + b - c
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c
      const predicted = [0, a, b, (a + b) >> 1, paeth][filter]!
      data[at] = raw[y * (stride + 1) + 1 + x]! + predicted
    }
  }
  return { width, height, data }
}

/** Part of the screen as a text picture. */
function crop(x: number, y: number, width: number, height: number): string {
  const rows: string[] = []
  for (let row = y; row < y + height; row++) {
    const start = row * display.width + x
    const pixels = display.pixels.subarray(start, start + width)
    rows.push([...pixels].map((color) => color.toString(16)).join(''))
  }
  return rows.join('\n')
}

it("draws the starter's hero standing in the middle of the screen", async () => {
  const game = await import('../template/main.ts')
  await ready()
  game.update()
  game.draw()

  expect(display.width).toBe(128)
  expect(crop(58, 58, 12, 12)).toBe(
    picture(`
      111111111111
      111111111111
      1111bbbb1111
      111bbbbbbb11
      1111ff0f0111
      1111fffff111
      111cccccc111
      111fccccf111
      1111c11c1111
      111441144111
      111111111111
      111111111111
    `),
  )
})
