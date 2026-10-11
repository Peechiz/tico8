import { display, colors as gameColors, palette, settings } from '../console.ts'
import { MAX_COLORS, type Rgb } from '../palette.ts'
import type { Screen } from '../screen.ts'
import type { LoadableSheet, Sheet } from '../sprites.ts'
import { createSheet } from '../sprites.ts'
import type { SheetChanged } from './event.ts'
import { SHEET_CHANGED } from './event.ts'
import type { Indexed } from './png.ts'
import { indexPixels, loadPixels } from './png.ts'

/**
 * How long to wait before the one second try at a file that would not
 * load. An editor that saves in two steps can be caught between them.
 */
export const RETRY_DELAY = 100

/** A decoded picture as RGBA bytes: the part of `ImageData` used here. */
export interface Pixels {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export interface SheetsOptions {
  screen: Screen
  /** Every colour the screen can show. Colours found in art are added. */
  colors: Rgb[]
  /** How many of `colors`, from the start, are the project's palette. */
  paletteSize: number | (() => number)
  /** Fetch and decode the PNG at an address. */
  load(url: string): Promise<Pixels>
  /** Milliseconds before the second try. Defaults to `RETRY_DELAY`. */
  retryDelay?: number
  /** Also say how many pixels of a sheet are outside the palette. */
  warnOffPalette?: boolean
}

export interface Sheets {
  sheet(url: string, cellWidth: number, cellHeight: number): Sheet
  ready(): Promise<void>
  reload(url: string): Promise<void>
  /** Load every sheet again, for when the palette has changed. */
  reloadAll(): Promise<void>
}

/**
 * What to say about pixels in colours from outside the palette. Art keeps
 * the colours it was painted in, so unless `warn` is on there is nothing to
 * say until the screen runs out of colours and some pixels take a nearby one.
 */
function reportOffPalette(url: string, indexed: Indexed, warn: boolean): void {
  const { snapped, offPalette } = indexed
  if (warn && offPalette > 0) {
    console.warn(
      `tico8: ${url} has ${offPalette} pixel${offPalette === 1 ? '' : 's'} ` +
        'in colours that are not in the palette',
    )
  }
  if (snapped === 0) return
  console.warn(
    `tico8: ${url} has ${snapped} pixel${snapped === 1 ? '' : 's'} drawn in ` +
      `the nearest colour: the screen can show ${MAX_COLORS} colours at once ` +
      'and all are in use',
  )
}

function reportFailure(url: string, error: unknown, kept: boolean): void {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.replace(/\.$/, '')
  console.error(
    `tico8: ${url} was not loaded: ${reason}. ` +
      (kept ? 'The old picture stays.' : 'The sheet stays empty.'),
  )
}

/** The sheets of one console, by address. `load` is passed in for tests. */
export function createSheets(options: SheetsOptions): Sheets {
  const {
    screen,
    colors,
    paletteSize,
    load,
    retryDelay = RETRY_DELAY,
    warnOffPalette = false,
  } = options

  interface Entry {
    sheet: LoadableSheet
    /** Counts loads started. A load that is no longer the last gives up. */
    turn: number
    loaded: boolean
  }

  const registry = new Map<string, Entry>()
  const loading = new Set<Promise<void>>()

  /**
   * Load `url` into its sheet. `fresh` asks past the browser's cache. Never
   * rejects, and leaves the sheet as it was if the file is bad or a newer
   * load has started since.
   */
  async function fill(url: string, entry: Entry, fresh: boolean) {
    const turn = ++entry.turn
    const stale = () => turn !== entry.turn
    try {
      let pixels: Pixels
      try {
        pixels = await load(fresh ? bust(url) : url)
      } catch {
        if (stale()) return
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        if (stale()) return
        pixels = await load(bust(url))
      }
      if (stale()) return
      const { data, width, height } = pixels
      const size = typeof paletteSize === 'number' ? paletteSize : paletteSize()
      const indexed = indexPixels(data, width, height, colors, size)
      entry.sheet.setImage(indexed.image)
      entry.loaded = true
      reportOffPalette(url, indexed, warnOffPalette)
    } catch (error) {
      if (!stale()) reportFailure(url, error, entry.loaded)
    }
  }

  function track(job: Promise<void>): Promise<void> {
    loading.add(job)
    job.then(() => loading.delete(job))
    return job
  }

  return {
    sheet(url, cellWidth, cellHeight) {
      const entry: Entry = {
        sheet: createSheet(screen, cellWidth, cellHeight),
        turn: 0,
        loaded: false,
      }
      // Asked for again when the generated file is re-run: the game that
      // starts next holds this sheet, so it replaces the one before.
      registry.set(url, entry)
      track(fill(url, entry, false))
      return entry.sheet
    },

    async ready() {
      await Promise.all(loading)
    },

    async reload(url) {
      const entry = registry.get(url)
      if (entry) await track(fill(url, entry, true))
    },

    async reloadAll() {
      await Promise.all(
        [...registry].map(([url, entry]) => track(fill(url, entry, false))),
      )
    },
  }
}

/** The same file under an address the browser has not fetched before. */
function bust(url: string): string {
  return `${url}?t=${Date.now()}`
}

const sheets = createSheets({
  screen: display,
  colors: palette,
  paletteSize: () => gameColors.size,
  load: loadPixels,
  warnOffPalette: settings.warnOffPalette,
})

/**
 * A sheet that draws to the console's screen and loads its picture from
 * `url`. Called by the generated `sprites.ts`, not by game code.
 */
export function sheet(
  url: string,
  cellWidth: number,
  cellHeight: number,
): Sheet {
  return sheets.sheet(url, cellWidth, cellHeight)
}

/** Settles when every sheet asked for so far has loaded. Never rejects. */
export function ready(): Promise<void> {
  return sheets.ready()
}

/** Load a changed PNG again and swap it into the sheet already in use. */
export function reload(url: string): Promise<void> {
  return sheets.reload(url)
}

// Listen here and not in the game's entry: the entry runs again on every
// code change, this module only once per page.
if (import.meta.hot) {
  import.meta.hot.on(SHEET_CHANGED, ({ url }: SheetChanged) => {
    reload(url)
  })
}
