import { restoreMaps } from './assets/maps.ts'
import { ready } from './assets/sheets.ts'
import { soundsReady } from './assets/sounds.ts'
import { attachUnlock } from './audio/unlock.ts'
import { display, mixer, pad, palette, settings, time } from './console.ts'
import { mount } from './host.ts'
import { attachGamepads } from './input/gamepad.ts'
import { attachKeyboard } from './input/keyboard.ts'
import { attachMouse } from './input/mouse.ts'
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

  Promise.all([ready(), soundsReady()]).then(() => {
    if (stopped) return
    display.clear()
    // A game that changed its maps starts again with them as saved.
    restoreMaps()
    // Game time starts again with the game.
    time.reset()
    // Effects stop; loops wait to see whether the new game plays them again.
    mixer.restarting()
    pad.releaseAll()
    const host = mount(document.body, display, palette)
    // Every device feeds the one pad, all the time.
    const detachKeyboard = attachKeyboard(window, pad)
    const gamepads = attachGamepads(navigator, pad)
    const detachMouse = settings.mouse
      ? attachMouse(host.canvas, display, pad)
      : () => {}
    // Browsers play nothing until the player presses something.
    const detachUnlock = mixer.unlocked
      ? () => {}
      : attachUnlock(window, () => mixer.unlock())
    let settled = false
    const loop = createLoop(game, {
      rate: settings.rate,
      onUpdate: pad.sample,
      afterUpdate() {
        time.step()
        // By the end of its first update the game has played the loops it
        // wants; the old game's others fall silent.
        if (!settled) {
          settled = true
          mixer.settle()
        }
      },
      beforeDraw: display.beginFrame,
      onDraw: host.present,
    })

    let frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step)
      gamepads.poll()
      loop.tick(now)
    })

    stop = () => {
      cancelAnimationFrame(frame)
      detachKeyboard()
      gamepads.detach()
      detachMouse()
      detachUnlock()
      host.destroy()
    }
  })

  return () => {
    stopped = true
    stop()
  }
}
