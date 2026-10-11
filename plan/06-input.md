# 06 — Input

## Demo

`examples/06-input` has a `tico8.config.ts` that names its actions and
switches on extras and the mouse, and exports the `input` it gets back. A
figure runs with the directions and jumps on `input.jump.pressed`, from
the keyboard and from a real controller at the same time, with neither
switched to. A second action is bound to a shoulder button and a key. The
left stick is shown as it moves, and a dot follows the pointer in game
pixels and changes while a mouse button is held.

## Spec

`01-spec.md`: Input, Project config, Positions and vectors.

## Decided

- **Actions are declared in the config and typed by inference.**
  `defineConfig` hands back the config with `input` on it; the config file
  exports it and the game imports it from there. Nothing is generated.
- **A binding is a string or a list of them:** a pad button, a key by the
  browser's `event.code`, or a mouse button. A pad button brings its
  default key with it.
- **Default keys:** arrows for the directions; A, S, W and D for `a`, `b`,
  `x` and `y`; Enter for start and either Shift for select.

## Layout

```
packages/tico8/src/input/types.ts     what a game reads and what devices call
packages/tico8/src/input/keys.ts      key names and the default keys
packages/tico8/src/input/pad.ts       buttons and actions, fed by every device
packages/tico8/src/input/keyboard.ts  keys into the pad
packages/tico8/src/input/gamepad.ts   controllers into the pad
packages/tico8/src/input/mouse.ts     the pointer into the pad
```

How input reaches a game: `defineConfig` makes one pad from the config's
actions and puts its `input` on the config. The console finds that pad on
the project's config, or makes a plain one. `run` attaches the keyboard and
the controllers to it, and the mouse when the config says so; the loop
samples it before each update. Devices only say which of their controls
are down. The pad works out the buttons and actions from that, so a button
stays down while any device holds it.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `Button`, `Input`, the extras,
  `Mouse`, `Binding`, `Actions` and the `Pad` that devices call, with the
  signature each device file exports; the key names and default keys;
  `actions`, `extras` and `mouse` in `Config`, what is refused, and
  `defineConfig` returning the config with a typed `input`.
  Owns: `src/input/types.ts`, `src/input/keys.ts`, `src/config.ts`,
  `src/config.test.ts`. Waits on: none.
- [x] **2. Pad.** `createPad`: a button or action is down while any device
  holds anything that drives it; a key named in an action leaves the
  default keys; the left stick past halfway gives directions; sticks have
  a dead zone; `pressed` and `released` last one update, and a tap between
  two samples is still seen. Carries over what `src/input.test.ts` checks.
  Owns: `src/input/pad.ts`, `src/input/pad.test.ts`. Waits on: 1.
- [x] **3. Keyboard.** `attachKeyboard`: keys the pad wants go to it and
  are kept from the browser; text fields and browser shortcuts are left
  alone; losing focus lets go of everything.
  Owns: `src/input/keyboard.ts`, `src/input/keyboard.test.ts`. Waits on: 1.
- [x] **4. Controllers.** `attachGamepads`: every connected controller with
  the standard layout is read when polled, buttons, triggers and both
  sticks; one that is unplugged lets go of what it held.
  Owns: `src/input/gamepad.ts`, `src/input/gamepad.test.ts`. Waits on: 1.
- [x] **5. Mouse.** `attachMouse`: the pointer's place over a scaled canvas
  in game pixels, whether it is over the screen, and its three buttons;
  the right-click menu is kept off the canvas.
  Owns: `src/input/mouse.ts`, `src/input/mouse.test.ts`. Waits on: 1.
- [x] **6. Demo.** The scene under "Demo", with its config.
  Owns: `examples/06-input/`. Waits on: 1.
- [x] **7. Wire up.** Lead only. The console takes its pad from the
  project's config; `run` attaches keyboard, controllers and, when on, the
  mouse, and polls controllers each frame; the host hands over its canvas;
  `index.ts` exports the new types; the old `src/input.ts` and its test go;
  a test that builds the console from a config with actions, presses a
  bound key and checks the pixel buffer; run the demo.
  Owns: `src/console.ts`, `src/console.test.ts`, `src/run.ts`,
  `src/host.ts`, `src/index.ts`, `src/actions.test.ts`, `src/input.ts`,
  `src/input.test.ts`. Waits on: 2, 3, 4, 5, 6.

## Check

- `pnpm test` passes, including: an action held by a key and a controller
  button stays down until both let go; a key named in an action no longer
  presses its default button; a config whose action is bound to something
  unknown, or to an extra with extras off, is refused by name; a pointer
  over a canvas shown at three times its size reported in game pixels; and
  a console built from a config with a `jump` action whose game draws a
  pixel on `input.jump.pressed`, seen in the buffer after a bound key goes
  down.
- `pnpm lint` and `pnpm typecheck` pass, and in example 06 an action name
  that is not in its config is a compile error.
- `pnpm dev` shows the Demo: the figure jumps from the keyboard and from a
  controller, and the dot follows the pointer.
- `pnpm dev 04-text` still runs, moving with the arrows and jumping on A.

## Decisions made

- **A key named in an action stops being a default key of the pad.** A
  game that binds `KeyA` to an action no longer gets button `a` from it.
- **Extras and the mouse are typed from the config.** `input.r1`,
  `input.leftStick` and `input.mouse` exist on the config's `input` only
  when the config says `extras: true` or `mouse: true`. An action bound to
  an extra or a mouse button without its switch is refused by name.
- **An action cannot take a name `input` already has,** such as `left` or
  `mouse`, and is letters and digits starting with a letter.
- **Controller buttons go by position:** `a` is the bottom face button,
  `b` the right, `x` the left, `y` the top.
- **The left stick gives directions** once pushed more than halfway, with
  extras on or off. Its exact value is an extra.
- **`input.mouse` is itself the position,** `{ x, y }` with `left`,
  `right`, `middle` and `inside` beside them, so it can be handed to
  anything that takes a position.
- **The system pointer stays visible** over the screen. A game that draws
  its own cursor draws it under the real one.
- **A controller without the standard layout is ignored,** with one
  `console.warn` naming it, the first time it is seen.
- **A trigger counts as down past half way,** and the stick values go to
  the pad raw, every poll: dead zones are the pad's.
- **The demo is a figure on a strip of ground at `240x136`, 60 a second.**
  It runs with the directions, jumps, and dashes; the left stick is a ring
  with a dot, the pointer a dot, and a three-line legend names the keys.
- **The demo's actions are `jump: ['a', 'Space']` and
  `dash: ['r1', 'ShiftLeft']`,** with `extras` and `mouse` on. `dash` is
  a burst of eight updates at four times the pace, the figure turning pink.
- **The pointer dot grows and changes colour while a button is held,** red
  for left and blue for right, and is drawn only while `input.mouse.inside`.
- **A modifier key's own press reaches the pad,** since pressing
  `ControlLeft` sets `ctrlKey`; the shortcut rule skips only other keys. A
  key-up still releases while a modifier is held.
- **The mouse uses mouse events, not pointer events.** Touch is not a
  target, and mouse events give the three buttons and the window-wide
  move and release the pad needs without pointer capture.
- **A press counts only if it began over the canvas.** A release is taken
  anywhere in the window, but only for a button that was pressed there, so
  a drag off the screen does not stick and a stray release is ignored.
- **A stick's dead zone is round,** a fifth of its reach, measured on the
  stick's length and not on each axis. With several controllers the stick
  reported is the one pushed furthest after the dead zone.
- **The left stick gives a direction past 0.5 on that axis,** read before
  the dead zone, and holds it apart from the d-pad: letting go of one does
  not release the other. A flick between two updates is seen like a tap.
- **`releaseAll` owes no press.** A button pressed and dropped by
  `releaseAll` before an update is never seen down; a tap that had already
  ended by hand is still seen.
- **`released` needs a press that was seen.** A button that goes down, up
  and down again inside one update reads as pressed, not also released.
- **The pointer starts at 0, 0 and outside,** and `releaseAll` leaves its
  position alone.
- **The engine finds the config's pad by the config object itself.**
  `defineConfig` keeps the pad it made beside the config it returns; the
  console asks for it and makes a plain pad when there is none, as for a
  config written without `defineConfig`. `input` from `tico8` and `input`
  from the config are then the same object.
- **A config that will be refused still gives its game buttons,** one for
  each action it names, so the game's imports do not fail before the
  refusal is reported.
- **Controllers are read once a frame,** before the updates that frame
  runs.
- **The palette moved into the config, and `palette()` is gone.** Added
  after the slice closed. With `defineConfig` handing back typed names,
  the reason slice 05 took the palette out of the config, a generated
  types file, no longer holds. `palette: { name: '#hex' }` is a setting
  and `COLOR` comes back beside `input`. Example 05 was ported: its
  `palette.ts` is now the `palette` in its config.
- **A palette cannot be replaced while the game runs.** Saving one reloads
  the page like any config change, where saving `palette.ts` used to
  restart the game alone. A bad palette is now refused in the terminal by
  name, like any other setting.
- **tico8 keeps layouts for controllers a browser gives none.** Added
  after the slice closed, when a DualSense Edge did nothing in Firefox,
  which reports it with an empty `mapping`: square is button 0, and the
  d-pad is one axis running from -1 at up through eight positions. The
  layout is found by vendor and product in the controller's id and covers
  the DualSense and the Edge. A controller with no standard layout and no
  kept one is still ignored with a warning, not guessed at.

## Not checked

- A real controller and a real keyboard and mouse. Keys, the pointer and a
  standard-layout controller were sent by script in the browser: the
  figure jumped from Space, from the A key and from the controller's
  bottom button, ran from the left stick, and the dot followed the pointer.
- `dash` and the shoulder button in the browser; only the pad's tests
  cover them.
- An action bound to a mouse button, outside the config and pad tests.
- Example 04 was seen to change on the arrows and on the A key, not
  watched frame by frame.
- Editing a colour in example 05's config and watching the page reload.
  The example was seen running with its palette after the move.
- The PS5 layout's triggers, stick clicks, start and select, which follow
  the controller's usual order and were not pressed, and the plain
  DualSense, which is taken to match the Edge that was measured.
