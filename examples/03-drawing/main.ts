import {
  COLOR,
  camera,
  circle,
  clear,
  clip,
  fill,
  input,
  line,
  oval,
  pixel,
  rect,
  SCREEN,
  screenSwap,
  stroke,
  vec,
} from 'tico8'
import { player } from './sprites'

// The world is two screens wide; the camera follows the hero across it.
const world = rect({
  x: 0,
  y: 0,
  width: SCREEN.width * 2,
  height: SCREEN.height,
})
const ground = rect({
  x: 0,
  y: 112,
  width: world.width,
  height: 16,
  fill: COLOR.darkGreen,
})
const crate = rect({
  x: 150,
  y: 96,
  width: 16,
  height: 16,
  fill: COLOR.brown,
  stroke: COLOR.orange,
})
const sun = circle({
  x: 200,
  y: 64,
  radius: 12,
  fill: COLOR.yellow,
  stroke: COLOR.orange,
})
const pond = oval({
  x: 64,
  y: 116,
  radiusX: 26,
  radiusY: 4,
  fill: COLOR.blue,
  stroke: COLOR.white,
})

// Screen furniture, drawn outside the camera.
const hud = rect({
  x: 0,
  y: 0,
  width: SCREEN.width,
  height: 9,
  fill: COLOR.black,
})
const spyglass = rect({ x: 86, y: 13, width: 38, height: 26 })

const hero = player.sprite()
const body = rect({ x: 0, y: 0, ...player.cell })
const cam = vec()
const icy = { [COLOR.red]: COLOR.blue, [COLOR.blue]: COLOR.white }
const night = {
  [COLOR.darkBlue]: COLOR.black,
  [COLOR.blue]: COLOR.darkBlue,
  [COLOR.yellow]: COLOR.lightGrey,
  [COLOR.green]: COLOR.darkGreen,
}
let flash = 0

export function init() {
  body.x = 60
  body.y = ground.y - body.height
}

export function update() {
  const dir = input.dir
  body.x = Math.max(0, Math.min(world.width - body.width, body.x + dir.x))
  body.y = Math.max(
    hud.height,
    Math.min(ground.y - body.height, body.y + dir.y),
  )
  if (dir.x !== 0) hero.flipX = dir.x < 0
  const moving = dir.x !== 0 || dir.y !== 0
  hero.frame = moving ? Math.floor((body.x + body.y) / 4) % player.frames : 0

  // Z flashes the hero white for a few frames; touching the crate chills it.
  if (input.a.pressed) flash = 6
  if (flash > 0) flash--
  hero.flash = flash > 0 ? COLOR.white : undefined
  hero.swap = rect.overlaps(body, crate) ? icy : undefined

  cam.x = body.x + body.width / 2 - SCREEN.width / 2
  cam.x = Math.max(0, Math.min(world.width - SCREEN.width, cam.x))
}

function drawWorld() {
  sun.draw()
  ground.draw()
  line({
    from: ground,
    to: { x: world.width, y: ground.y },
    color: COLOR.green,
  })
  pond.draw()
  crate.draw()
  line({
    from: crate,
    to: { x: crate.x + 15, y: crate.y + 15 },
    color: COLOR.orange,
  })
  for (let x = 8; x < world.width; x += 32) pixel(x, 20 + (x % 48), COLOR.white)
  hero.draw(body)
}

export function draw() {
  clear(COLOR.darkBlue)
  camera(cam, drawWorld)

  // A second view of the world, fixed on the crate, cut to a small window.
  clip(spyglass, () => {
    fill(spyglass, COLOR.black)
    camera(crate.x - spyglass.x - 11, crate.y - spyglass.y - 8, drawWorld)
  })
  stroke(spyglass, COLOR.white)

  hud.draw()
  line({
    from: { x: 0, y: hud.height },
    to: { x: SCREEN.width, y: hud.height },
    color: COLOR.lightGrey,
  })
  // How far across the world the hero is. A bare object is a shape too.
  const reach = Math.floor((body.x / world.width) * (SCREEN.width - 4))
  fill({ x: 2, y: 3, width: reach, height: 3 }, COLOR.red)

  // Hold X for night.
  if (input.b.held) screenSwap(night)
}
