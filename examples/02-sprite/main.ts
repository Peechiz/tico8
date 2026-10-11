import { COLOR, clear, input, pixel, SCREEN, vec } from 'tico8'
import { player } from './sprites'

const hero = player.sprite()
const pos = vec()
const dot = vec()
const speed = vec(1, 0)

export function init() {
  pos.x = SCREEN.width / 2 - player.cell.width / 2
  pos.y = SCREEN.height / 2 - player.cell.height / 2
  dot.x = 0
  dot.y = 8
}

export function update() {
  const dir = input.dir
  vec.move(pos, dir)
  if (dir.x !== 0) hero.flipX = dir.x < 0
  // Step through the walk frames while moving.
  const moving = dir.x !== 0 || dir.y !== 0
  hero.frame = moving ? Math.floor((pos.x + pos.y) / 4) % player.frames : 0

  vec.move(dot, speed)
  dot.x %= SCREEN.width
}

export function draw() {
  clear(COLOR.darkBlue)
  pixel(dot, COLOR.red)
  hero.draw(pos)
}
