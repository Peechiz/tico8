import { resolveConfig } from './config.ts'
import { createPad } from './input.ts'
import { lightest, PICO8, type Rgb } from './palette.ts'
import project from './project.ts'
import { createScreen } from './screen.ts'

/** The project's config with every choice made. */
export const settings = resolveConfig(project)

// The one console every game draws to, built from the project's config.
export const display = createScreen(settings.width, settings.height)
export const pad = createPad()

// Every colour the screen can show. The first `colors.size` are the game's
// palette; colours found in imported art are added after them.
export const palette: Rgb[] = [...PICO8]

/** What is known of the game's palette. Read it when needed: it can change. */
export const colors = {
  /** How many of `palette`, from the start, are the game's own. */
  size: palette.length,
  /** The colour text is drawn in when given none: the palette's lightest. */
  text: lightest(palette),
}

const watchers = new Set<() => void>()

/** Call `changed` whenever the game's palette is replaced. */
export function onPaletteChange(changed: () => void): void {
  watchers.add(changed)
}

/**
 * Replace the game's palette. Colours found in art go too, so every picture
 * has to be matched to the new colours again; that is what watchers are for.
 * Setting the palette it already has does nothing.
 */
export function setPalette(list: readonly Rgb[]): void {
  const same =
    list.length === colors.size &&
    list.every((rgb, i) => rgb.every((part, j) => part === palette[i]?.[j]))
  if (same) return
  palette.length = 0
  palette.push(...list)
  colors.size = list.length
  colors.text = lightest(list)
  for (const changed of watchers) changed()
}
