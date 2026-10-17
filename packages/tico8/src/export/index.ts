import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { projectName } from '../vite/project.ts'
import { buildGame, type InlinedAsset } from './build.ts'
import { typeCheck } from './check.ts'
import { exportPage } from './page.ts'

export type { InlinedAsset } from './build.ts'

export interface ExportOptions {
  /** The project folder. */
  root: string
  /** The file to write. Defaults to `dist/<project>.html` in `root`. */
  out?: string
  /** Type-check first. Defaults to true. */
  check?: boolean
}

export interface ExportResult {
  /** The file written. */
  path: string
  /** Its size. */
  bytes: number
  /** Every asset packed into the page, largest first. */
  assets: InlinedAsset[]
  /** What the export thinks the game should know, one line each. */
  warnings: string[]
}

/** Thrown by `exportGame` when the type-check finds errors. */
export class TypeCheckError extends Error {
  /** What tsc printed. */
  output: string

  constructor(errors: number, output: string) {
    super(
      `Export stopped: ${errors} type error${errors === 1 ? '' : 's'}. ` +
        '(--no-check to export anyway)',
    )
    this.name = 'TypeCheckError'
    this.output = output
  }
}

/** Type-check, build and write a project as one HTML file. */
export async function exportGame(
  options: ExportOptions,
): Promise<ExportResult> {
  const root = resolve(options.root)
  const name = projectName(root)
  if (options.check !== false) {
    const { errors, output } = await typeCheck({ root })
    if (errors > 0) throw new TypeCheckError(errors, output)
  }
  const { js, css, assets } = await buildGame({ root })
  const html = exportPage({ title: name, js, css })
  const path = resolve(root, options.out ?? join('dist', `${name}.html`))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, html)
  const largest = [...assets].sort(
    (a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path),
  )
  return {
    path,
    bytes: Buffer.byteLength(html),
    assets: largest,
    warnings: largest.filter(isWav).map(wavWarning),
  }
}

function isWav({ path }: InlinedAsset): boolean {
  return extname(path).toLowerCase() === '.wav'
}

function wavWarning({ path, bytes }: InlinedAsset): string {
  return (
    `${path} is ${formatSize(bytes)} of uncompressed audio: ` +
    'an ogg or mp3 is about a tenth of that'
  )
}

/** A size as people read it: `812 B`, `212.4 KB`, `1.3 MB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
