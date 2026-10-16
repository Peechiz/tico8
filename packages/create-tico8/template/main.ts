import { clear, SCREEN, vec } from 'tico8'
import { player } from './sprites'
import { COLOR, input } from './tico8.config'

// The hero is drawn in sprites/player.png. Open the Sprites tab beside the
// game to paint it, and add more PNGs to the folder for more sheets.
const hero = player.sprite({
  x: (SCREEN.width - player.cell.width) / 2,
  y: (SCREEN.height - player.cell.height) / 2,
})

// An animation is plain data: which cells of the sheet, and how fast.
const stand = { frames: [0], fps: 1 }
const walk = { frames: [0, 1], fps: 8 }

// Pixels moved each update. Try 2.
const speed = 1

export function update() {
  // The arrow keys or a gamepad, as -1, 0 or 1 on each axis.
  const dir = input.dir
  vec.move(hero, vec.scale(dir, speed))
  if (dir.x !== 0) hero.flipX = dir.x < 0
  hero.play(dir.x !== 0 || dir.y !== 0 ? walk : stand)
}

export function draw() {
  clear(COLOR.darkBlue)
  hero.draw()
}
