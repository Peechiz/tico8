import { COLOR, circle, clear, rect, SCREEN, text } from 'tico8'
import { input } from './tico8.config'

const groundY = SCREEN.height - 24
const ground = rect({
  x: 0,
  y: groundY,
  width: SCREEN.width,
  height: SCREEN.height - groundY,
  fill: COLOR.darkGreen,
})

const figure = rect({ x: 0, y: 0, width: 8, height: 12, fill: COLOR.orange })
let fall = 0
let facing = 1
let dashing = 0

// The left stick: a ring, with a dot where the stick is.
const stickRing = circle({
  x: SCREEN.width - 24,
  y: 24,
  radius: 14,
  stroke: COLOR.darkGrey,
})
const stickDot = circle({ x: 0, y: 0, radius: 3, fill: COLOR.yellow })

// The pointer: a dot that grows and changes colour while a button is held.
const pointer = circle({ x: 0, y: 0, radius: 2, fill: COLOR.white })

const legend = [
  '←→ move  A/Space jump',
  'Shift/R1 dash',
  'left stick, mouse: try them',
]

export function init() {
  figure.x = SCREEN.width / 2 - figure.width / 2
  figure.y = groundY - figure.height
  fall = 0
  dashing = 0
}

export function update() {
  const floor = groundY - figure.height

  if (input.dir.x !== 0) facing = input.dir.x
  if (input.dash.pressed) dashing = 8
  const speed = dashing > 0 ? 4 : 1
  if (dashing > 0) dashing--
  const move = dashing > 0 ? facing : input.dir.x
  figure.x = Math.max(
    0,
    Math.min(SCREEN.width - figure.width, figure.x + move * speed),
  )

  if (input.jump.pressed && figure.y === floor) fall = -4
  fall += 0.5
  figure.y = Math.min(floor, figure.y + fall)
  if (figure.y === floor) fall = 0
  figure.fill = dashing > 0 ? COLOR.pink : COLOR.orange

  const stick = input.leftStick
  stickDot.x = stickRing.x + stick.x * stickRing.radius
  stickDot.y = stickRing.y + stick.y * stickRing.radius

  const { mouse } = input
  pointer.x = mouse.x
  pointer.y = mouse.y
  pointer.radius = mouse.left.held || mouse.right.held ? 5 : 2
  pointer.fill = mouse.left.held
    ? COLOR.red
    : mouse.right.held
      ? COLOR.blue
      : COLOR.white
}

export function draw() {
  clear(COLOR.darkBlue)
  ground.draw()
  figure.draw()

  stickRing.draw()
  stickDot.draw()
  text('stick', { x: stickRing.x, y: stickRing.y + 18, align: 'center' })

  legend.forEach((words, row) => {
    text(words, { x: 4, y: 4 + row * 8, color: COLOR.lightGrey })
  })

  if (input.mouse.inside) pointer.draw()
}
