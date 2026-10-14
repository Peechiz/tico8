import { lightest, type Rgb } from '../palette.ts'
import type { BaseStyle } from './types.ts'

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

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
}
`
}
