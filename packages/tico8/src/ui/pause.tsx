import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { DIRECTION_EVENT } from './context.ts'
import { Menu } from './menu.tsx'
import type { Direction, PauseControls, PauseScreenProps } from './types.ts'

const clamp = (value: number) => Math.min(10, Math.max(0, value))

/** The volume as the player sees it: 0 to 10. */
function level(volume: number) {
  return clamp(Math.round(volume * 10))
}

/**
 * Calls `onStep` with -1 for ← and 1 for → while `ref`'s element has the
 * highlight, keeping the highlight where it is. ↑ and ↓ pass on to the nav.
 */
function useSideways(
  ref: { current: HTMLElement | null },
  onStep: (by: -1 | 1) => void,
) {
  // The listener reads this, so it always sees the latest render.
  const latest = useRef(onStep)
  latest.current = onStep
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const direction = (event: Event) => {
      const detail = (event as CustomEvent<Direction>).detail
      if (detail !== 'left' && detail !== 'right') return
      event.preventDefault()
      latest.current(detail === 'left' ? -1 : 1)
    }
    element.addEventListener(DIRECTION_EVENT, direction)
    return () => element.removeEventListener(DIRECTION_EVENT, direction)
  }, [])
}

/** A volume arrow, dimmed as `tico8-pause-end` once it can step no further. */
const arrow = (end: boolean) =>
  end ? 'tico8-pause-arrow tico8-pause-end' : 'tico8-pause-arrow'

/**
 * The volume button: ← and → step it by a tenth, Ⓐ or a click steps it up,
 * wrapping from 10 to 0. The level keeps two digits' room, so 9 and 10 are
 * the same width.
 */
function Volume({ controls }: { controls: PauseControls }) {
  const button = useRef<HTMLButtonElement>(null)
  // `controls` is a plain object, so a change needs a render of our own.
  const [, setShown] = useState(level(controls.volume))
  const now = level(controls.volume)
  const set = (next: number) => {
    controls.volume = next / 10
    setShown(next)
  }
  useSideways(button, (by) => set(clamp(now + by)))

  return (
    <button
      type="button"
      class="tico8-pause-volume"
      ref={button}
      onClick={() => set(now === 10 ? 0 : now + 1)}
    >
      Volume <span class={arrow(now === 0)}>←</span>{' '}
      <span class="tico8-pause-level">{now}</span>{' '}
      <span class={arrow(now === 10)}>→</span>
    </button>
  )
}

/** The Sound switch: `Sound: on`. ←, →, Ⓐ or a click flips it. */
function Sound({ controls }: { controls: PauseControls }) {
  const button = useRef<HTMLButtonElement>(null)
  // `controls` is a plain object, so a change needs a render of our own.
  const [, setShown] = useState(controls.sound)
  const flip = () => {
    controls.sound = !controls.sound
    setShown(controls.sound)
  }
  useSideways(button, flip)
  return (
    <button type="button" class="tico8-pause-sound" ref={button} onClick={flip}>
      Sound: {controls.sound ? 'on' : 'off'}
    </button>
  )
}

/** The options screen: the volume and whether sound is heard. */
function Options({
  controls,
  onBack,
}: {
  controls: PauseControls
  onBack(): void
}) {
  return (
    <Menu class="tico8-options" onBack={onBack}>
      <h2>Options</h2>
      <Volume controls={controls} />
      <Sound controls={controls} />
      {!controls.unlocked && (
        <p class="tico8-pause-unlock">Press a key for sound</p>
      )}
      <button type="button" onClick={onBack}>
        Back
      </button>
    </Menu>
  )
}

/** The controls screen: each row's label, then its bindings. */
function Controls({
  controls,
  onBack,
}: {
  controls: PauseControls
  onBack(): void
}) {
  return (
    <Menu class="tico8-controls" onBack={onBack}>
      <h2>Controls</h2>
      {controls.controls.map((row) => (
        <div class="tico8-control" key={row.label}>
          <span class="tico8-control-label">{row.label}</span>
          <span class="tico8-control-bindings">{row.bindings.join(' ')}</span>
        </div>
      ))}
      <button type="button" onClick={onBack}>
        Back
      </button>
    </Menu>
  )
}

/** The screens under the pause menu, each opened from a button in it. */
type Screen = 'options' | 'controls'

/**
 * The pause menu over a dimmed screen: Resume, the game's items, Options
 * and Controls. `run` renders it while the game is paused.
 */
export function PauseScreen({ controls, items }: PauseScreenProps) {
  const [screen, setScreen] = useState<Screen | undefined>()
  const opener = {
    options: useRef<HTMLButtonElement>(null),
    controls: useRef<HTMLButtonElement>(null),
  }
  const was = useRef<Screen | undefined>(undefined)

  // Back from a screen, the highlight returns to the button that opened it.
  useLayoutEffect(() => {
    if (was.current && !screen) opener[was.current].current?.focus()
    was.current = screen
  })

  // A click bubbling out of the game's items closes the menu, unless the
  // item prevented it. Listened for by hand: the div is not itself a control.
  const itemsDiv = useRef<HTMLDivElement>(null)
  const latest = useRef(controls)
  latest.current = controls
  useLayoutEffect(() => {
    const div = itemsDiv.current
    if (!div) return
    const closeAfter = (event: Event) => {
      if (!event.defaultPrevented) latest.current.resume()
    }
    div.addEventListener('click', closeAfter)
    return () => div.removeEventListener('click', closeAfter)
  }, [])

  const back = () => setScreen(undefined)

  return (
    <div class="tico8-pause">
      {/* Kept mounted under a screen, so it keeps its place. */}
      <Menu
        class="tico8-pause-menu"
        onBack={() => controls.resume()}
        hidden={screen !== undefined}
      >
        <h2>Paused</h2>
        <button type="button" onClick={() => controls.resume()}>
          Resume
        </button>
        <div class="tico8-pause-items" ref={itemsDiv}>
          {items}
        </div>
        <button
          type="button"
          class="tico8-pause-options"
          ref={opener.options}
          onClick={() => setScreen('options')}
        >
          Options
        </button>
        <button
          type="button"
          class="tico8-pause-controls"
          ref={opener.controls}
          onClick={() => setScreen('controls')}
        >
          Controls
        </button>
      </Menu>
      {screen === 'options' && <Options controls={controls} onBack={back} />}
      {screen === 'controls' && <Controls controls={controls} onBack={back} />}
    </div>
  )
}
