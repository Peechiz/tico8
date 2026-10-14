import {
  COLOR,
  camera,
  clear,
  clock,
  input,
  rect,
  SCREEN,
  text,
  vec,
} from 'tico8'
import { room1 } from './maps'
import { player, tiles } from './sprites'

// A sprite knows where it is and how big, so it is also the box walls stop.
const hero = player.sprite()
const cam = vec()

// Animations are plain data: which frames, how fast, and whether they loop.
const stand = { frames: [0], fps: 1 }
const walk = { frames: [1, 2], fps: 8 }
const attack = { frames: [3, 4, 5], fps: 12, loop: false }

// True from the press of A until the swing has finished.
let attacking = false
const hud = rect({
  x: 0,
  y: 0,
  width: SCREEN.width,
  height: 9,
  fill: COLOR.black,
})

export function init() {
  // The markers layer is never drawn: its tiles only say where things go.
  const [start] = room1.markers.tiles('spawn')
  if (start) {
    hero.x = start.x
    hero.y = start.y
  }
}

export function update() {
  const dir = input.dir

  // The hero stands still while swinging. Otherwise try each axis on its
  // own and take back a step that ends in a solid tile, so the hero slides
  // along a wall instead of sticking to it.
  if (!attacking) {
    hero.x += dir.x
    if (room1.walls.overlaps(hero, 'solid')) hero.x -= dir.x
    hero.y += dir.y
    if (room1.walls.overlaps(hero, 'solid')) hero.y -= dir.y
    if (dir.x !== 0) hero.flipX = dir.x < 0
  }

  // Pick the animation; play moves it on one update and sets hero.frame.
  const moving = dir.x !== 0 || dir.y !== 0
  if (input.a.pressed) {
    attacking = true
    hero.play(attack, { restart: true })
  } else if (attacking) {
    hero.play(attack)
    if (hero.finished) attacking = false
  } else {
    hero.play(moving ? walk : stand)
  }

  // Keep the hero mid-screen, and the camera inside the map.
  cam.x = hero.x + hero.width / 2 - SCREEN.width / 2
  cam.y = hero.y + hero.height / 2 - SCREEN.height / 2
  cam.x = Math.max(0, Math.min(room1.width - SCREEN.width, cam.x))
  cam.y = Math.max(0, Math.min(room1.height - SCREEN.height, cam.y))
}

export function draw() {
  clear(COLOR.black)
  camera(cam, () => {
    room1.ground.draw()
    room1.walls.draw()
    hero.draw()
    // Drawn after the hero, so it passes behind these tiles.
    room1.front.draw()
  })

  hud.draw()
  const column = Math.floor((hero.x + hero.width / 2) / tiles.cell.width)
  const row = Math.floor((hero.y + hero.height / 2) / tiles.cell.height)
  // Blinks once a second, at any update rate.
  if (clock.seconds % 1 < 0.5) {
    text('A: attack', { x: SCREEN.width - 40, y: 2, color: COLOR.yellow })
  }
  text(`cell ${column}, ${row}`, { x: 2, y: 2, color: COLOR.white })
}
