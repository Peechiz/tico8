// The editors' look: tico8's own sixteen colours and its font, whatever
// palette the project paints with, so the editors and the console look like
// one machine.
import { useLayoutEffect } from 'preact/hooks'
import { PICO8, type Rgb } from '../palette.ts'
import { addFont } from '../ui/font.ts'
import { type ActionName, SHORTCUTS, type ToolName } from './types.ts'

const rgb = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`

/** A console colour by number, as CSS. */
export const k = (index: number): string => rgb(PICO8[index] ?? [255, 0, 255])

/** What each console colour is for in the editors. */
export const INK = {
  /** Behind everything. */
  ground: k(1),
  /** Panels, rails, the tab bar and the canvas surround. */
  well: k(0),
  /** Borders and quiet text. */
  line: k(13),
  text: k(6),
  bright: k(7),
  /** The chosen tool, the zoomed cells. */
  active: k(10),
  error: k(8),
} as const

/** See-through pixels: one faint checker behind the whole canvas. */
export const CHECKER = { size: 16, light: '#0e1529', dark: k(0) } as const

/** Grid lines over the art: pixels faint, cells firm. */
export const GRID = {
  pixel: 'rgb(131 118 156 / 0.18)',
  cell: 'rgb(131 118 156 / 0.7)',
} as const

/**
 * CSS custom properties and base rules for anything inside `.t8e`.
 * `--k0` to `--k15` are the console colours; `--pixel` is the tico8 font,
 * for numbers and short labels at 12px or 18px; `--sans` is for sentences.
 */
export const BASE_CSS = `
.t8e { ${PICO8.map((c, i) => `--k${i}: ${rgb(c)};`).join(' ')}
  --pixel: tico8, ui-monospace, monospace;
  --sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--k6); font: 12px/1 var(--pixel); }
.t8e button { font: inherit; color: inherit; background: none; border: 0;
  padding: 0; margin: 0; cursor: pointer; border-radius: 0; }
.t8e button:disabled { opacity: 0.35; cursor: default; }
.t8e :focus-visible { outline: 2px solid var(--k10); outline-offset: 1px; }
.t8e canvas { image-rendering: pixelated; }
.t8e kbd { font: 12px var(--pixel); color: var(--k7); }
.t8e-dialog { position: fixed; inset: 0; display: grid; place-items: center;
  background: rgb(29 43 83 / 0.85); z-index: 10; }
.t8e-dialog > form, .t8e-dialog > div { background: var(--k0); color: var(--k6);
  box-shadow: 0 0 0 2px var(--k13); padding: 18px; display: grid; gap: 12px;
  width: min(360px, calc(100vw - 32px)); font: 14px/1.4 var(--sans); }
.t8e-dialog h2 { margin: 0; font: 18px/1 var(--pixel); color: var(--k7); font-weight: 400; }
.t8e-dialog label { display: grid; gap: 4px; }
.t8e-dialog input, .t8e-dialog select { font: 14px var(--sans); color: var(--k7);
  background: var(--k1); border: 0; padding: 6px 8px; }
.t8e-dialog .t8e-actions { display: flex; justify-content: flex-end; gap: 8px; }
.t8e-dialog .t8e-actions button { padding: 6px 12px; background: var(--k1); color: var(--k7); }
.t8e-dialog .t8e-actions button[type="submit"] { background: var(--k10); color: var(--k0); }
.t8e-dialog .t8e-note { color: var(--k13); }
.t8e-dialog .t8e-error { color: var(--k8); }
`

/**
 * Put `css` in the page once, under `id`, along with the base rules and the
 * tico8 font. Every editor component calls this with its own rules.
 */
export function useStyle(id: string, css: string): void {
  useLayoutEffect(() => {
    addFont(document)
    for (const [key, text] of [
      ['tico8-editor-base', BASE_CSS],
      [id, css],
    ] as const) {
      if (document.getElementById(key)) continue
      const style = document.createElement('style')
      style.id = key
      style.textContent = text
      document.head.append(style)
    }
  }, [id, css])
}

/** Whether keys should be labelled the Mac way, with ⌘ and ⇧. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

const NAMED: Readonly<Record<string, string>> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc',
  delete: 'Del',
  backspace: '⌫',
}

/**
 * A key as `SHORTCUTS` spells it, as a label: `mod+shift+z` reads `⇧⌘Z` on
 * a Mac and `Ctrl+Shift+Z` elsewhere.
 */
export function keyLabel(key: string, mac = isMac()): string {
  const parts = key.split('+')
  const last = parts.pop() ?? ''
  const name = NAMED[last] ?? last.toUpperCase()
  if (mac) {
    const shift = parts.includes('shift') ? '⇧' : ''
    const mod = parts.includes('mod') ? '⌘' : ''
    return `${shift}${mod}${name}`
  }
  return [
    ...(parts.includes('mod') ? ['Ctrl'] : []),
    ...(parts.includes('shift') ? ['Shift'] : []),
    name,
  ].join('+')
}

/** The label of the first key that does `what`, if any does. */
export function shortcutFor(
  what: ToolName | ActionName,
  mac = isMac(),
): string | undefined {
  const key = Object.keys(SHORTCUTS).find((k) => SHORTCUTS[k] === what)
  return key === undefined ? undefined : keyLabel(key, mac)
}

/** `name (key)`, for a button's title. */
export function titled(name: string, what: ToolName | ActionName): string {
  const key = shortcutFor(what)
  return key ? `${name} (${key})` : name
}
