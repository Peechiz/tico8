import { COLOR, clear, input, type LayerOf, SCREEN, text, vec } from 'tico8'
import { world } from './maps'
import { player } from './sprites'

// The world map is four rooms in a 2 by 2 grid, each one screen. Only the
// room the figure is in is drawn and collided with; its position is in
// pixels inside that room, so nothing below needs a camera or a clip.
const room = { x: 0, y: 0, width: SCREEN.width, height: SCREEN.height }

const figure = { pos: vec(), vel: vec(), onFloor: false }
const hero = player.sprite()

const stand = { frames: [0], fps: 1 }
const walk = { frames: [1, 2], fps: 8 }

const RUN = 1
const GRAVITY = 0.25
const JUMP = 4.5
const FALL = 4

/** Draws one layer of the world: the whole of it, or a room's view. */
function drawLayer(layer: LayerOf<typeof world>) {
  layer.draw()
}

/** Whether the figure's box, at a position in the room, is in a wall. */
function blocked(at: { x: number; y: number }) {
  const walls = world.walls.area(room)
  return walls.overlaps(
    { ...at, width: hero.width, height: hero.height },
    'solid',
  )
}

/**
 * Past a room's edge the figure is in the next room: move the room over
 * and the figure back by a room, so it stands at the opposite edge.
 */
function changeRoom() {
  const middle = {
    x: figure.pos.x + hero.width / 2,
    y: figure.pos.y + hero.height / 2,
  }
  if (middle.x >= room.width && room.x + room.width < world.width) {
    room.x += room.width
    figure.pos.x -= room.width
  } else if (middle.x < 0 && room.x > 0) {
    room.x -= room.width
    figure.pos.x += room.width
  }
  if (middle.y >= room.height && room.y + room.height < world.height) {
    room.y += room.height
    figure.pos.y -= room.height
  } else if (middle.y < 0 && room.y > 0) {
    room.y -= room.height
    figure.pos.y += room.height
  }
}

/** Where a layer's spawn tile is in the current room, if it has one. */
function spawnIn(layer: LayerOf<typeof world>) {
  const [start] = layer.area(room).tiles('spawn')
  return start
}

export function init() {
  // The markers layer is never drawn: its tiles only say where things go.
  const start = spawnIn(world.markers)
  if (start) {
    figure.pos.x = start.x
    figure.pos.y = start.y
  }
}

export function update() {
  figure.vel.x = input.dir.x * RUN
  figure.vel.y = Math.min(figure.vel.y + GRAVITY, FALL)
  if (input.a.pressed && figure.onFloor) figure.vel.y = -JUMP
  // Let go of A early for a short hop.
  if (input.a.released && figure.vel.y < 0) figure.vel.y /= 2

  // A pixel at a time, stopping flush against the current room's walls.
  const hit = vec.step(figure.pos, figure.vel, blocked)
  if (hit.y) figure.vel.y = 0
  // On the floor when a wall is one pixel below the floored position.
  figure.onFloor = blocked({
    x: Math.floor(figure.pos.x),
    y: Math.floor(figure.pos.y) + 1,
  })

  changeRoom()

  if (input.dir.x !== 0) hero.flipX = input.dir.x < 0
  hero.play(input.dir.x !== 0 && figure.onFloor ? walk : stand)
}

export function draw() {
  clear(COLOR.black)
  drawLayer(world.ground.area(room))
  drawLayer(world.walls.area(room))
  hero.draw(figure.pos)

  const column = room.x / room.width
  const row = room.y / room.height
  text(`room ${column}, ${row}`, { x: 10, y: 10, color: COLOR.white })
}
