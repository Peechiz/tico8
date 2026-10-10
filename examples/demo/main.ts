import { clear, pixel, screen } from 'tico8'

let x = 0
let y = 0

export function init() {
  x = 0
  y = screen.height / 2
}

export function update() {
  x = (x + 1) % screen.width
}

export function draw() {
  clear(1)
  pixel(x, y, 8)
}
