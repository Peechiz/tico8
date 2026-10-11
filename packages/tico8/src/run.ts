import { ready } from './assets/sheets.ts'
import { display, pad, palette, settings } from './console.ts'
import { mount } from './host.ts'
import { attachKeyboard } from './input.ts'
import type { Game } from './loop.ts'
import { createLoop } from './loop.ts'

/**
 * Start a game in the page once its assets have loaded. Returns a function
 * that stops it and removes it from the page, so a code change can start
 * the new version cleanly.
 */
export function run(game: Game): () => void {
  let stop = () => {}
  let stopped = false

  ready().then(() => {
    if (stopped) return
    display.clear()
    pad.releaseAll()
    const host = mount(document.body, display, palette)
    const detach = attachKeyboard(window, pad)
    const loop = createLoop(game, {
      rate: settings.rate,
      onUpdate: pad.sample,
      beforeDraw: display.beginFrame,
      onDraw: host.present,
    })

    let frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step)
      loop.tick(now)
    })

    stop = () => {
      cancelAnimationFrame(frame)
      detach()
      host.destroy()
    }
  })

  return () => {
    stopped = true
    stop()
  }
}
