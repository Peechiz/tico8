import type { ComponentChildren, HTMLAttributes } from 'preact'
import type { Input } from '../input/types.ts'
import type { Rgb } from '../palette.ts'

/** What a game's `ui` returns: JSX, text, a list of them, or nothing. */
export type UiNode = ComponentChildren

/** A box on the page, in CSS pixels, as `getBoundingClientRect` gives it. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A way the highlight moves. */
export type Direction = 'left' | 'right' | 'up' | 'down'

/**
 * What `<Menu>` takes: `onBack` for Ⓑ, its children, and anything a `div`
 * takes, which it passes on.
 */
export type MenuProps = Omit<HTMLAttributes<HTMLDivElement>, 'ref'> & {
  /** Called when Ⓑ is pressed while this is the top menu. */
  onBack?(): void
  children?: ComponentChildren
}

/** A menu on screen, as the nav knows it. */
export interface MenuEntry {
  /** The menu's element; what it holds that can be focused is navigable. */
  readonly element: HTMLElement
  /** Called when Ⓑ is pressed while this menu is on top. */
  onBack?(): void
}

/**
 * The menus on screen and the highlight in the top one. While any menu is
 * open the pad belongs to the UI.
 */
export interface Nav {
  /** Whether any menu is open; then the game's input reads as idle. */
  readonly active: boolean
  /**
   * A menu came on screen: it goes on top of any open before it. Returns a
   * function for when it leaves.
   */
  open(menu: MenuEntry): () => void
  /**
   * Act on the pad for one update: a direction pressed moves the highlight
   * in the top menu, Ⓐ pressed clicks what is highlighted, Ⓑ pressed calls
   * the top menu's `onBack`. Nothing happens with no menu open.
   */
  step(pad: Input): void
}

/** Measures an element on the page. */
export type Measure = (element: Element) => Box

/** `src/ui/nav.ts` exports `createNav` of this type. */
export type CreateNav = (measure?: Measure) => Nav

/**
 * `src/ui/nav.ts` exports `pick` of this type: the index of the nearest of
 * `candidates` from `from` in `direction`, or undefined when none lies that
 * way.
 */
export type Pick = (
  from: Box,
  candidates: readonly Box[],
  direction: Direction,
) => number | undefined

/** What a layer is made with. */
export interface LayerOptions {
  /** Each palette name with its colour number, as `COLOR` has them. */
  colors: Readonly<Record<string, number>>
  /** Every colour, by number. */
  palette: readonly Rgb[]
  /** The nav every `<Menu>` in the layer opens itself with. */
  nav: Nav
}

/** The game's UI, drawn into an element over the screen. */
export interface UiLayer {
  /** Show what `ui` returned, patching only what changed. */
  render(node: UiNode): void
  /** Unmount everything and empty the element. */
  destroy(): void
}

/** `src/ui/layer.ts` exports `createLayer` of this type. */
export type CreateLayer = (
  element: HTMLElement,
  options: LayerOptions,
) => UiLayer

/**
 * `src/ui/style.ts` exports `baseStyle` of this type: the layer's default
 * CSS, in `@layer tico8`, with a variable for each name in `colors`.
 */
export type BaseStyle = (
  colors: Readonly<Record<string, number>>,
  palette: readonly Rgb[],
) => string

/**
 * `src/ui/font.ts` exports `addFont` of this type: adds the console's font
 * to the document as the `tico8` font face.
 */
export type AddFont = (document: Document) => void
