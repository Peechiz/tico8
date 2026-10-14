import { createElement, Fragment } from 'preact'
import type { Mixer, RememberedSound } from './audio/types.ts'
import type { Bindings, Pad } from './input/types.ts'
import type { Game } from './loop.ts'
import { controlRows } from './ui/controls.ts'
import { PauseScreen } from './ui/pause.tsx'
import type { Nav, PauseControls, UiNode } from './ui/types.ts'

/** The built-in pause menu: whether the game is paused, and what it shows. */
export interface Pause {
  /** Whether the game is frozen under the menu. */
  readonly paused: boolean
  /**
   * Act on the pad for one update, after it is sampled: the pause button
   * opens or closes the menu, and the game's input is muted under any menu.
   */
  step(): void
  /** What the layer shows: the game's `ui`, and the menu over it when paused. */
  ui(): UiNode
  /** Close the menu, if open, so a restart starts with sound running. */
  close(): void
}

export interface PauseOptions {
  game: Game
  pad: Pad
  nav: Nav
  mixer: Mixer
  /** The game's actions, for the controls screen. */
  actions: Bindings
  /** Where the sound settings are kept from one visit to the next. */
  sound: RememberedSound
}

export function createPause({
  game,
  pad,
  nav,
  mixer,
  actions,
  sound,
}: PauseOptions): Pause {
  let paused = false

  function open() {
    paused = true
    mixer.hold()
  }

  function close() {
    if (!paused) return
    paused = false
    mixer.release()
  }

  const keep = () => sound.store({ volume: mixer.volume, sound: mixer.soundOn })

  const controls: PauseControls = {
    resume: close,
    get volume() {
      return mixer.volume
    },
    set volume(next: number) {
      mixer.volume = next
      keep()
    },
    get sound() {
      return mixer.soundOn
    },
    set sound(on: boolean) {
      mixer.soundOn = on
      keep()
    },
    get unlocked() {
      return mixer.unlocked
    },
    controls: controlRows(actions),
  }

  return {
    get paused() {
      return paused
    },
    step() {
      // Escape is Ⓑ in a menu that has somewhere to go back to, so the nav
      // takes it: it backs out of the controls screen, resumes from the
      // pause menu, and leaves a game's menu that has an `onBack`. Anywhere
      // else it pauses. Start opens and closes from anywhere.
      const backing = pad.pause.pressed && pad.raw.b.pressed
      if (pad.pause.pressed && !(backing && (paused || nav.backable))) {
        if (paused) close()
        else open()
      }
      // While any menu is on screen the pad is the UI's, not the game's.
      pad.mute(paused || nav.active)
      nav.step(pad.raw)
    },
    ui() {
      return createElement(
        Fragment,
        null,
        game.ui?.(),
        paused &&
          createElement(PauseScreen, { controls, items: game.pause?.() }),
      )
    },
    close,
  }
}
