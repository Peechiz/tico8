import { readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { SOUNDS_DIR, SOUNDS_FILE } from './sounds.ts'
import { SPRITES_DIR, SPRITES_FILE } from './sprites.ts'

export interface DataUrlOptions {
  /** The file's name, whose extension gives the type. */
  file: string
  bytes: Uint8Array
}

const types: Record<string, string> = {
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
}

/** A file's bytes as a base64 `data:` URL. */
export function dataUrl({ file, bytes }: DataUrlOptions): string {
  const type = types[extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
}

export interface InlineAssetsOptions {
  /**
   * Called with each file inlined: its path from the project folder,
   * `sounds/theme.wav`, and its size before encoding.
   */
  onInline?: (path: string, bytes: number) => void
}

/**
 * At build, swaps each sheet and sound address in the generated
 * `sprites.ts` and `sounds.ts` for a `data:` URL of the file.
 */
export function inlineAssets({ onInline }: InlineAssetsOptions = {}): Plugin {
  let root = ''
  return {
    name: 'tico8:inline-assets',
    apply: 'build',
    // Before Vite's own transform, which rewrites the quotes the match looks for.
    enforce: 'pre',
    configResolved(config) {
      root = resolve(config.root)
    },
    transform(code, id) {
      const path = resolve(id.split('?')[0]!)
      const dir =
        path === join(root, SPRITES_FILE)
          ? SPRITES_DIR
          : path === join(root, SOUNDS_FILE)
            ? SOUNDS_DIR
            : undefined
      if (dir === undefined) return undefined
      const address = new RegExp(`'/${dir}/([^']*)'`, 'g')
      return {
        code: code.replace(address, (_, encoded: string) => {
          const file = decodeURIComponent(encoded)
          let bytes: Buffer
          try {
            bytes = readFileSync(join(root, dir, file))
          } catch {
            throw new Error(`Cannot inline ${dir}/${file}: the file is missing`)
          }
          onInline?.(`${dir}/${file}`, bytes.byteLength)
          return `'${dataUrl({ file, bytes })}'`
        }),
        map: null,
      }
    },
  }
}
