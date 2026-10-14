import { describe, expect, it } from 'vitest'
import { encodePng } from './png.ts'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const inflate = async (bytes: Uint8Array) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream('deflate')),
    ).arrayBuffer(),
  )

/** Split a PNG into its chunks, checking the signature and every CRC. */
function chunks(png: Uint8Array) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const found: { type: string; data: Uint8Array }[] = []
  let at = 8
  while (at < png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const data = png.subarray(at + 8, at + 8 + length)
    expect(view.getUint32(at + 8 + length)).toBe(
      crc32(png.subarray(at + 4, at + 8 + length)),
    )
    found.push({ type, data })
    at += 12 + length
  }
  return found
}

describe('encodePng', () => {
  it('writes a 3x2 RGBA image with a transparent pixel that reads back exactly', async () => {
    // prettier-ignore
    const data = new Uint8ClampedArray([
      255, 0, 77, 255, 0, 0, 0, 0, 41, 173, 255, 255, 0, 228, 54, 255, 255, 255,
      255, 128, 1, 2, 3, 255,
    ])
    const found = chunks(await encodePng({ width: 3, height: 2, data }))
    expect(found.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])

    const [ihdr, idat] = found as [(typeof found)[0], (typeof found)[0]]
    const header = new DataView(
      ihdr.data.buffer,
      ihdr.data.byteOffset,
      ihdr.data.byteLength,
    )
    expect(header.getUint32(0)).toBe(3)
    expect(header.getUint32(4)).toBe(2)
    expect([...ihdr.data.subarray(8)]).toEqual([8, 6, 0, 0, 0])

    const raw = await inflate(idat.data)
    expect(raw).toHaveLength(2 * (1 + 3 * 4))
    const rows = [0, 1].map((y) => raw.subarray(y * 13, (y + 1) * 13))
    expect(rows.map((r) => r[0])).toEqual([0, 0])
    expect([...rows.flatMap((r) => [...r.subarray(1)])]).toEqual([...data])
  })
})
