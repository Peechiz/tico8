import { COLOR, clear, input, SCREEN, vec } from 'tico8'
import { blip } from './sounds'
import { dot } from './sprites'

const pos = vec(SCREEN.width / 2, SCREEN.height / 2)
const sprite = dot.sprite()

export function init() {}

export function update() {
  vec.move(pos, input.dir)
  if (input.dir.x !== 0) blip.play()
}

export function draw() {
  clear(COLOR.black)
  sprite.draw(pos)
}
