import { lightest, type Rgb } from '../palette.ts'
import type { BaseStyle } from './types.ts'

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

const light = ([r, g, b]: Rgb) => 299 * r + 587 * g + 114 * b

/** The colour whose brightness is lowest, or nearest `target` if given. */
const pick = (palette: readonly Rgb[], target: number) => {
  let best = palette[0] as Rgb
  for (const c of palette) {
    if (Math.abs(light(c) - target) < Math.abs(light(best) - target)) best = c
  }
  return best
}

/**
 * The layer's default CSS. Every rule is scoped to `[data-tico8-ui]`, so the
 * layer must put this `<style>` inside its root element and give that
 * element the attribute `data-tico8-ui`. All of it sits in `@layer tico8`,
 * so any game CSS beats it whatever its specificity.
 */
export const baseStyle: BaseStyle = (colors, palette) => {
  const root = '[data-tico8-ui]'
  const variables = Object.entries(colors)
    .map(([name, index]) => `    --${name}: ${hex(palette[index] as Rgb)};`)
    .join('\n')
  const darkest = pick(palette, -1)
  const mid = pick(
    palette,
    (light(darkest) + light(palette[lightest(palette)] as Rgb)) / 2,
  )
  return `@layer tico8 {
  ${root} {
${variables}
    font: 6px/6px tico8;
    color: ${hex(palette[lightest(palette)] as Rgb)};
    pointer-events: none;
    -webkit-font-smoothing: none;
    font-smooth: never;
    user-select: none;
    image-rendering: pixelated;
  }
  ${root} :is(button, a, input, select, textarea, [tabindex]) { pointer-events: auto; }
  ${root} button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }
  ${root} :focus {
    outline: 1px solid currentColor;
    outline-offset: 1px;
  }
  ${root} .tico8-pause {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 50%);
  }
  ${root} :is(.tico8-pause-menu, .tico8-options, .tico8-controls) {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
    background: ${hex(darkest)};
    border: 1px solid ${hex(mid)};
  }
  ${root} :is(.tico8-pause-menu, .tico8-options, .tico8-controls)[hidden] { display: none; }
  ${root} :is(.tico8-pause-menu, .tico8-options, .tico8-controls) :is(h2, p) {
    margin: 0;
    font: inherit;
  }
  ${root} .tico8-pause-items { display: contents; }
  ${root} .tico8-pause-level {
    display: inline-block;
    width: 2ch;
    text-align: center;
  }
  ${root} .tico8-pause-end { color: ${hex(mid)}; }
  ${root} .tico8-control {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
}
`
}
