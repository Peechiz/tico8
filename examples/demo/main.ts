import { COLOR, clear, pixel, SCREEN, vec } from 'tico8'

const dot = vec()
const speed = vec(1, 0)

export function init() {
  dot.x = 0
  dot.y = SCREEN.height / 2
}

export function update() {
  vec.move(dot, speed)
  dot.x %= SCREEN.width
}

export function draw() {
  clear(COLOR.darkBlue)
  pixel(dot, COLOR.red)
}
