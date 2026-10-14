# 12 — Pause menu

## Demo

`examples/12-pause`, a new game copied from `examples/11-ui`: the star
catcher with its own pause menu taken out. Start or Escape opens the
built-in one over the frozen, dimmed screen: Resume, the game's "Quit to
title", Options (volume, sound) and Controls.
The controls screen lists the pad and the game's `boost` action with their
bindings. The game has music and a catch sound from `examples/09-audio`;
the music keeps playing while paused and the volume can be heard changing.
The title says "Press a key for sound" until `audio.unlocked`.

## Spec

`01-spec.md`: Pause menu; Sound, the first press and the master volume;
Text and UI, "How the UI layer works".

## Decided

- **Pico-8's model:** one built-in menu, the same freeze in every game, a
  game adds items. No replacing it, no Restart.
- **Opens on** Start or Escape, unless an action takes them. Enter and
  Escape are Ⓐ and Ⓑ in every menu.
- **`update`, `draw` and `clock` stop;** CSS dims the frozen frame.
- **Loops play while paused; effects hold.**
- **`audio.unlocked`** is read-only from `tico8`.
- **A game exports `pause`** returning buttons; choosing one closes the
  menu unless its click calls `preventDefault()`.
- **The volume is remembered** per game, apart from the save.

## Layout

```
packages/tico8/src/ui/types.ts         + PauseControls, ControlRow
packages/tico8/src/ui/context.ts       + DIRECTION_EVENT
packages/tico8/src/ui/pause.tsx        PauseScreen: the backdrop and the menu around what `pause` returns
packages/tico8/src/ui/controls.ts      controlRows: the controls screen's rows from the bindings
packages/tico8/src/ui/nav.ts           a direction offered to the focused element first
packages/tico8/src/ui/style.ts         the pause menu's default CSS
packages/tico8/src/input/types.ts      + Pad.pause
packages/tico8/src/input/keys.ts       Escape a default key of `start`
packages/tico8/src/input/pad.ts        pad.pause
packages/tico8/src/audio/types.ts      + Voice pause/resume, Mixer hold/release
packages/tico8/src/audio/mixer.ts      hold, release
packages/tico8/src/audio/web.ts        a voice paused and resumed at its place
packages/tico8/src/audio/volume.ts     the remembered master volume
packages/tico8/src/loop.ts             Game.pause; frozen: no game update, no draw
packages/tico8/src/index.ts            audio
packages/tico8/src/run.ts              opening, freezing, the menu's controls
```

One update, as `run` drives it:

```
pad.sample()
pad.pause.pressed      toggles paused: opening holds effects, closing releases them
pad.mute(paused || nav.active)
nav.step(pad.raw)
paused ? nothing : game.update(), clock.step()
layer.render(<>{game.ui?.()}{paused && <PauseScreen controls items={game.pause?.()} />}</>)
```

While paused the loop skips `draw` too, so the last frame stays shown. The
layer is made for every game, since every game can pause.

`PauseScreen` is a `div.tico8-pause` (the backdrop) holding a
`<Menu class="tico8-pause-menu" onBack={resume}>`: a Resume button, the
game's items in a `div.tico8-pause-items`, Options and Controls. A click
that bubbles out of the items resumes unless it was `defaultPrevented`.
Controls opens a nested `<Menu class="tico8-controls">` listing the rows
(`.tico8-control`, a label and its bindings) and a Back button; Ⓑ or Back
closes it.

A direction the nav would move by is first sent to the focused element as
a cancellable `DIRECTION_EVENT` with the direction as `detail`; if it is
cancelled the highlight stays. The volume button uses it: ← and → step the
volume by a tenth, shown as 0 to 10; Ⓐ or a click steps it up, wrapping
from 10 to 0. While `unlocked` is false a "Press a key for sound" line
shows under it.

The controls rows: one row for ← ↑ → ↓, one each for Ⓐ Ⓑ Ⓧ Ⓨ with the
default keys no action has taken, then each action with its bindings. A
pad button shows as its symbol (Ⓐ, ←) or its
name (L1, Start); a key by its label (`KeyK` K, `Digit1` 1, `ArrowLeft` ←,
`Escape` Esc, `ShiftLeft` Shift); a mouse button as `Mouse left`.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `PauseControls` (`resume()`,
  `volume` from 0 to 1 that can be set, `unlocked`, `controls:
  ControlRow[]`), `ControlRow` (`label`, `bindings: string[]`),
  `DIRECTION_EVENT`, `Pad.pause`, `Voice.pause`/`resume`,
  `Mixer.hold`/`release`, `Game.pause` and `LoopOptions.frozen`, `audio`
  from `tico8`; the signature of every file below, each throwing "not
  yet".
  Owns: `src/ui/types.ts`, `src/ui/context.ts`, `src/input/types.ts`,
  `src/audio/types.ts`, `src/index.ts`, the declarations in every file
  below. Waits on: none.
- [x] **2. Pause button.** Escape a default key of `start`. `pad.pause`:
  the `start` slot, never muted, idle when an action names `start`; a key
  an action names stops driving it.
  Owns: `src/input/keys.ts`, `src/input/pad.ts`, `src/input/pad.test.ts`.
  Waits on: 1.
- [x] **3. Hold.** `mixer.hold()` pauses every one-off copy, `release()`
  carries them on where they were; loops play through. A sound's `stop`
  and `restarting` stop held copies too. In `web.ts` a paused voice keeps
  its place in the clip and resumes from it.
  Owns: `src/audio/mixer.ts`, `src/audio/mixer.test.ts`, `src/audio/web.ts`.
  Waits on: 1.
- [x] **4. Volume memory.** `rememberVolume(store?)`: `load()` gives the
  stored volume, or 1 when there is none or it is not a number from 0 to 1;
  `store(volume)`. The browser store is `localStorage` under
  `tico8:<project>:volume`, falling back to memory as the save does.
  Owns: `src/audio/volume.ts`, `src/audio/volume.test.ts`. Waits on: 1.
- [x] **5. Nav direction.** As under "Layout": a direction goes to the
  focused element as a cancellable `DIRECTION_EVENT` first, and the
  highlight moves only if it is not cancelled.
  Owns: `src/ui/nav.ts`, `src/ui/nav.test.ts`. Waits on: 1.
- [x] **6. Controls rows.** `controlRows(actions)`: the rows under
  "Layout", in that order, from the game's `Bindings`.
  Owns: `src/ui/controls.ts`, `src/ui/controls.test.ts`. Waits on: 1.
- [x] **7. Pause screen.** `PauseScreen({ controls, items })` as under
  "Layout". Tested in happy-dom with a fake `PauseControls` and a nav: the
  order of the items, Ⓑ resuming, a game's item resuming after its
  `onClick` and not when it prevents default, ← → and Ⓐ changing the
  volume, the unlock line, the controls screen opening and Ⓑ going back.
  Owns: `src/ui/pause.tsx`, `src/ui/pause.test.tsx`. Waits on: 1.
- [x] **8. Style.** In `@layer tico8`: `.tico8-pause` fills the overlay
  with a translucent black backdrop and centres its content;
  `.tico8-pause-menu` and `.tico8-controls` are panels in the palette's
  darkest colour with a 1 px border, items in a column.
  Owns: `src/ui/style.ts`, `src/ui/style.test.ts`. Waits on: 1.
- [x] **9. Loop freeze.** `frozen()` true: an update runs `onUpdate` and
  `afterUpdate` but not `game.update`, and no draw runs at all.
  Owns: `src/loop.ts`, `src/loop.test.ts`. Waits on: 1.
- [x] **10. Demo.** The game under "Demo", with its sounds, a `boost`
  action (`['b', 'Space']`, the paddle moving faster) and its `pause`
  export.
  Owns: `examples/12-pause/`. Waits on: 1.
- [x] **11. Wire up.** Lead only. `run` as under "Layout": the layer for
  every game, the master volume loaded and stored, `PauseControls` from
  the mixer and the settings' actions, `audio.unlocked` from the mixer. A
  test driving a game through pause: `update`, `draw` and `clock` stopped,
  the press that opened it not reaching the game, Ⓑ resuming; run the
  demo.
  Owns: `src/run.ts`, `src/console.ts`, `src/pause.test.tsx`.
  Waits on: 2–10.

## Check

- `pnpm test` passes, including: `pad.pause` pressed by Start and
  Escape and not by a key an action takes; held effects carrying on and
  loops playing through; the volume remembered and a bad stored one read
  as 1; a cancelled direction leaving the highlight; the controls rows for
  a game with and without actions; the pause menu's items in order with a
  game's item closing it; a paused game's `update`, `draw` and `clock`
  stopped.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm dev` shows the Demo: pause by keyboard and controller, volume
  heard changing, the controls screen, the game's two items.
- `pnpm dev 11-ui` still runs, and Start opens the built-in menu over it.

## Decisions made

- Pause screen: the controls screen replaces the pause panel rather than
  sitting over it. The pause `<Menu>` stays mounted with `hidden` set, so
  it keeps its nav entry; the controls `<Menu>` is its sibling inside
  `.tico8-pause` and, opened last, has the pad. Closing it focuses the
  Controls button again. Ⓑ on the controls screen only closes it.
  Classes: `tico8-pause`, `tico8-pause-menu` (with an `h2` "Paused"),
  `tico8-pause-items`, `tico8-pause-volume`, `tico8-pause-unlock` (a `p`),
  `tico8-pause-controls` (the button), `tico8-controls` (with an `h2`
  "Controls"), `tico8-control` rows of `tico8-control-label` and
  `tico8-control-bindings` (the bindings joined by spaces). The volume
  shows as `Volume ← 8 →` and steps in whole tenths (rounded first), so it
  never drifts; ↑ ↓ pass on to the nav. The level sits in a
  `tico8-pause-level` span two digits wide, so 9 and 10 take the same room
  and the panel never resizes; an arrow that can step no further (← at 0,
  → at 10) gets `tico8-pause-end` and the border's dim colour. The Sound switch
  flips on ←, → or Ⓐ, so every option row answers the same keys. The items' click listener is added
  by hand, as a `div` with `onClick` fails biome's a11y rules.
- Volume memory: the volume is stored as JSON text; `load()` gives 1 for a
  missing value, bad JSON, a non-number, NaN or anything outside 0 to 1, and
  for a store that throws. `store()` swallows a store that throws on write
  (a lost volume is not worth a crash). The default store
  is a separate `tico8:<project>:volume` key with the same fallback as the
  save.
- `pad.pause` is a slot of its own, never muted, driven by the
  controller's Start and by Escape, each unless an action names it. Enter
  is no longer a default key of `start` (Start has no default key now).
  `pad.raw` reads Enter as Ⓐ and Escape as Ⓑ whatever the game bound them
  to, so they confirm and go back in every menu. `createPause` lets the
  nav have an Escape while any menu is open; Start opens and closes from
  anywhere. (First built with Start, Enter and Escape all toggling pause,
  which made Enter on a pause item close the menu instead of choosing it;
  changed after the user tried it.)
- Nav direction: the event is sent on the focused element with the window
  of its own document (`ownerDocument.defaultView.CustomEvent`), once per
  pressed direction, before the move is worked out. A cancelled one skips
  that direction only; Ⓐ and Ⓑ are unaffected.
- Hold: a one-off played during a hold sounds (a menu item's click sound,
  say) and is not paused; `release` resumes only what `hold` paused. Volume
  changes reach held copies, so a copy resumes at the new gain.
- In `web.ts` a voice keeps one gain node and starts a new source at its
  offset on `resume`; only the source now playing can fire `onEnded`, so a
  paused or stopped voice never reads as ended.
- Loop freeze (restored by the lead; lost to a concurrent edit): `frozen`
  is read after each `onUpdate` and once before the draw. `init` always
  runs; a loop frozen from the start runs `init`, `onUpdate` and
  `afterUpdate` and draws nothing.
- Style (restored): `palette.ts` has no `darkest`, so `style.ts` keeps two
  helpers: the panel background is the dimmest colour, the border the one
  nearest halfway between dimmest and lightest. The lead added
  `[hidden] { display: none }` for the panels, since the controls screen
  hides the pause menu, and reset `h2`/`p` margins and font in them.
- Controls rows: the directions row reads `Arrows` when all four arrow
  keys are free, else the free arrows as symbols. Every pad row stays even
  with no key left to it, since a controller still presses its button
  (first built dropping such rows; the lead changed it).
- Demo (restored): `boost` doubles the paddle's speed while held; the
  theme loops at 0.4 from `init` and `swing` plays on a catch; the title
  hint wraps onto two lines to fit 128 pixels.
- Wire up: the pause logic is `src/pause.ts` (`createPause`), so the
  integration test drives the same code `run` does. `run` loads the
  remembered volume into the mixer at each start, and closes the pause
  (releasing held effects) when it stops, so a code change mid-pause
  starts clean.
- After the user tried it: Escape opens pause over a game's menu that has
  no `onBack` (the title), using a new `nav.backable`; `<Menu>` hands the
  nav its `onBack` through a getter, so a menu without one has none. The
  Controls screen lists no Pause row. `attachUnlock` skips Escape and any
  press `navigator.userActivation` says is not the user acting, and keeps
  listening; before, an Escape first left the mixer unlocked while the
  browser kept sound off, so music waited until something played again.
- Demo restyles the built-in menu from its own `ui.css`: grey buttons with
  the highlighted one yellow behind a ★, as its own menus are, and headings
  white, so nothing but the highlight reads as something to choose. Its
  yellow `h2` rule is scoped to `.panel`.
- Nav: `pick` measures across the direction as the gap between the boxes,
  0 where they overlap, not between centres; centres stay for along. A
  left-aligned list of buttons of different widths skipped entries before.
- Options (after the user asked for music and effects switches, as
  Pico-8's options submenu): the pause menu is Resume, items, Options,
  Controls; Options holds Volume, Music, Effects, the unlock line and Back.
  The mixer's `music` and `effects` fold into each copy's gain (loops are
  music, one-offs effects), so switched-off sounds play on silent.
  `audio/volume.ts` became `audio/settings.ts`: `rememberSound` keeps
  `{ volume, music, effects }` under `tico8:<project>:sound`, each bad or
  missing field taking its default. The demo dropped its own music toggle
  and its `music` save field.
- Options, later: Music and Effects were too fine, so they became one
  Sound switch (`.tico8-pause-sound`). The mixer's `soundOn` (its `sound()`
  already makes sounds) silences every copy, loops and one-offs alike, and
  `rememberSound` keeps `{ volume, sound }`. Volume stays as it was.
- Nav: a box counts as that way only when it lies wholly past `from`'s far
  edge (touching, within half a pixel, counts), replacing slice 11's "centre
  strictly past". In a column of buttons of different widths → went to a
  wider button above; now ← and → do nothing there, and the volume keeps
  them for itself.
