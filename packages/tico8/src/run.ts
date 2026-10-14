import { restoreMaps } from './assets/maps.ts'
import { ready } from './assets/sheets.ts'
import { soundsReady } from './assets/sounds.ts'
import { rememberSound } from './audio/settings.ts'
import { attachUnlock } from './audio/unlock.ts'
import { display, mixer, pad, palette, settings, time } from './console.ts'
import { mount } from './host.ts'
import { attachGamepads } from './input/gamepad.ts'
import { attachKeyboard } from './input/keyboard.ts'
import { attachMouse } from './input/mouse.ts'
import type { Game } from './loop.ts'
import { createLoop } from './loop.ts'
import { createPause } from './pause.ts'
import { addFont } from './ui/font.ts'
import { createLayer } from './ui/layer.ts'
import { createNav } from './ui/nav.ts'

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
    // The UI layer sits over the screen. Every game has one, since every
    // game can pause; one with no `ui` leaves it empty until then.
    addFont(document)
    const nav = createNav()
    const layer = createLayer(host.overlay, {
      colors: settings.colors,
      palette,
      nav,
    })
    // The player's sound settings from the pause menu, kept from last time.
    const sound = rememberSound()
    Object.assign(mixer, sound.load())
    const pause = createPause({
      game,
      pad,
      nav,
      mixer,
      actions: settings.actions,
      sound,
    })
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
      onUpdate() {
        pad.sample()
        pause.step()
      },
      // Under the pause menu the game neither updates nor draws.
      frozen: () => pause.paused,
      afterUpdate() {
        if (!pause.paused) time.step()
        layer.render(pause.ui())
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
      // Held effects are let go, so a restart's `restarting` stops them.
      pause.close()
      layer.destroy()
      pad.mute(false)
      host.destroy()
    }
  })

  return () => {
    stopped = true
    stop()
  }
}
