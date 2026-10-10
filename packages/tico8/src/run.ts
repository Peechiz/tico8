import { display, palette, RATE } from './console.ts'
import { mount } from './host.ts'
import type { Game } from './loop.ts'
import { createLoop } from './loop.ts'

/**
 * Start a game in the page. Returns a function that stops it and removes
 * it from the page, so a code change can start the new version cleanly.
 */
export function run(game: Game): () => void {
  display.clear()
  const host = mount(document.body, display, palette)
  const loop = createLoop(game, { rate: RATE, onDraw: host.present })

  let frame = requestAnimationFrame(function step(now) {
    frame = requestAnimationFrame(step)
    loop.tick(now)
  })

  return () => {
    cancelAnimationFrame(frame)
    host.destroy()
  }
}
