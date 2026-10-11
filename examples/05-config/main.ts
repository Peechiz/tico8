import { clear, fill, input, rect, SCREEN, stroke, text } from 'tico8'
import { COLOR } from './palette'
import { wisp } from './sprites'

// Nothing here knows the screen's size or how many colours there are. The
// size comes from tico8.config.ts and the colours from palette.ts, so
// changing either rearranges all of this.
const edge = 2
const line = text.measure('A').height + edge * 2

// The swatches share what is left between a line of text above and below.
const board = rect({
  x: edge,
  y: line,
  width: SCREEN.width - edge * 2,
  height: SCREEN.height - line * 2,
})

// As many columns as the longest colour name allows.
const palette = Object.entries(COLOR)
const widest = Math.max(...palette.map(([name]) => text.measure(name).width))
const columns = Math.max(1, Math.floor(board.width / (widest + edge * 3)))
const rows = Math.ceil(palette.length / columns)
const cell = {
  width: Math.floor(board.width / columns),
  height: Math.floor(board.height / rows),
}
const named = cell.height > line

// One swatch for each colour in the palette, in palette order.
const swatches = palette.map(([name, color], index) => ({
  name,
  color,
  ...rect({
    x: board.x + (index % columns) * cell.width,
    y: board.y + Math.floor(index / columns) * cell.height,
    width: cell.width - 1,
    height: cell.height - 1,
  }),
}))

const hero = wisp.sprite()
const body = rect({ x: 0, y: 0, ...wisp.cell })
let steps = 0

// A game is not told its update rate, so this one counts it.
let rate = 0
let count = 0
let since = 0

export function init() {
  body.x = Math.floor((SCREEN.width - body.width) / 2)
  body.y = Math.floor((SCREEN.height - body.height) / 2)
  since = Date.now()
}

export function update() {
  count++
  if (Date.now() - since >= 1000) {
    rate = count
    count = 0
    since = Date.now()
  }

  const dir = input.dir
  body.x = Math.max(0, Math.min(SCREEN.width - body.width, body.x + dir.x))
  body.y = Math.max(0, Math.min(SCREEN.height - body.height, body.y + dir.y))
  if (dir.x !== 0) hero.flipX = dir.x < 0
  if (dir.x !== 0 || dir.y !== 0) steps++
  hero.frame = Math.floor(steps / 8) % wisp.frames
}

export function draw() {
  clear(COLOR.night)

  // The wisp picks out the swatch under its middle.
  const middle = { x: body.x + body.width / 2, y: body.y + body.height / 2 }
  const under = swatches.find((swatch) => rect.contains(swatch, middle))

  for (const swatch of swatches) {
    fill(swatch, swatch.color)
    if (named) {
      // A name sits on a dark plate, so it reads on any colour.
      const at = { x: swatch.x + edge, y: swatch.y + edge }
      const plate = {
        x: at.x - 1,
        y: at.y - 1,
        width: widest + 2,
        height: line - edge - 1,
      }
      fill(plate, COLOR.night)
      text(swatch.name, at)
    }
  }
  if (under) stroke(under, COLOR.paper)
  hero.draw(body)

  text(`${SCREEN.width}x${SCREEN.height}`, {
    x: edge,
    y: edge,
    color: COLOR.honey,
  })
  text(`${rate || '--'} updates/s`, {
    x: SCREEN.width - edge,
    y: edge,
    color: COLOR.lantern,
    align: 'right',
  })

  // Text with no colour takes the palette's lightest.
  const foot = { x: edge, y: SCREEN.height - line + edge }
  text(under ? `COLOR.${under.name} = ${under.color}` : 'Find a colour', foot)
  text('← ↑ → ↓', { ...foot, x: SCREEN.width - edge, align: 'right' })
}
