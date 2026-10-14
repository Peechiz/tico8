# 10 — Save

## Demo

`examples/10-save`, a new game: stars fall and a paddle moved with ← →
catches them through a round of 15 seconds. The HUD shows the score and
the best; a round that beats the best writes it. Ⓐ starts a round, and
holding Ⓑ for a second on the title clears the best. Reloading the page
keeps the best.

## Spec

`01-spec.md`: Saving, Project config.

## Decided

- **The shape is a setting in the config,** `save: { best: 0 }`, typed by
  inference and widened; `save` is destructured off what `defineConfig`
  returns.
- **Fields are read off `save` and are readonly;** `save.write(fields)`
  merges and stores at once; `save.clear()` goes back to the defaults.
- **A read never gives undefined:** the stored save is laid over the
  defaults, missing fields default, unknown fields are dropped, a field of
  another kind defaults.
- **The demo is a new example,** at the user's choice.

## Layout

```
packages/tico8/src/save/types.ts    SaveData, SaveValue, Save, SaveOf, SaveStore
packages/tico8/src/save/check.ts    readSave: the config's save setting checked
packages/tico8/src/save/save.ts     overlay, and createSave over a SaveStore
packages/tico8/src/save/storage.ts  memoryStore, browserStore, projectStore
packages/tico8/src/vite/project.ts  projectName, and the plugin that hands it to the page
```

How a save reaches a game: `defineConfig` makes the save from the
config's `save` defaults, as it makes the pad from its actions. The save
asks `projectStore()` for its store on first use, never when it is made,
because the dev tool also runs the config in Node. In the page that is
`localStorage` under `tico8:<project>:save`, where the dev tool's
`project` plugin defines `__TICO8_PROJECT__`; anywhere else it is a store
in memory. A code restart does not re-run the config file, so the save
object lives on, and it is what was stored anyway.

The stored text is the whole save as JSON. Laying it over the defaults:

```
defaults: { best: 0, level: 1, opts: { music: true, speed: 2 } }
stored:   { best: 90, level: 'x', old: 5, opts: { music: false } }
fields:   { best: 90, level: 1, opts: { music: false, speed: 2 } }
```

The kinds are number, string, boolean, null, array and object. An array
is taken whole when the stored value is an array; its items are not
checked.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `SaveValue`, `SaveData`,
  `Widen`, `Save`, `SaveOf`, `SaveStore`; the signature of every file
  under "Layout"; type tests for widening, readonly fields and `write`
  refusing an unknown field.
  Owns: `src/save/types.ts`, `src/save/types.test.ts`, the declarations in
  every file below. Waits on: none.
- [x] **2. Save object.** `overlay(defaults, stored)` as under "Layout",
  copying so neither argument is shared with the result.
  `createSave(defaults, store)`: reads the store on first use of a field,
  `write` or `clear`; `write` merges the top-level fields given (skipping
  `undefined`), copies them, and stores the whole save as JSON; `clear`
  removes the stored save. Stored text that is not JSON gives the defaults
  with a console warning. A store that throws is warned about once, and the
  save carries on in memory.
  Owns: `src/save/save.ts`, `src/save/save.test.ts`. Waits on: 1.
- [x] **3. Config check.** `readSave(written)`: undefined gives `{}`; a
  plain object of plain data gives itself; anything else throws a message
  naming the field, by its path (`save.opts.speed`), and what it holds:
  a function, `undefined`, NaN or Infinity, a class instance such as a
  `Date`, a field called `write` or `clear`.
  Owns: `src/save/check.ts`, `src/save/check.test.ts`. Waits on: 1.
- [x] **4. Storage.** `memoryStore()`; `browserStore(storage, key)` over
  any `Storage`; `projectStore()`: `browserStore(localStorage,
  'tico8:<project>:save')` when there is a `localStorage` and
  `__TICO8_PROJECT__` is defined, else `memoryStore()`.
  Owns: `src/save/storage.ts`, `src/save/storage.test.ts`. Waits on: 1.
- [x] **5. Project name.** `projectName(root)`: the `name` in the root's
  `package.json`, else the folder's name. `project()`: a Vite plugin that
  defines `__TICO8_PROJECT__` as it.
  Owns: `src/vite/project.ts`, `src/vite/project.test.ts`. Waits on: 1.
- [x] **6. Demo.** The game under "Demo", with its config, package and no
  assets.
  Owns: `examples/10-save/`. Waits on: 1.
- [x] **7. Wire up.** Lead only. `save` joins the config's settings,
  checked by `readSave`; `defineConfig` hands back `save` made with
  `projectStore`; `index.ts` exports the types; the project plugin joins
  the dev tool; a test that writes through one defined config and reads it
  back through another over the same store; run the demo.
  Owns: `src/config.ts`, `src/index.ts`, `src/vite.ts`,
  `src/save.test.ts`. Waits on: 2, 3, 4, 5, 6.

## Check

- `pnpm test` passes, including: an old shape laid over the defaults as
  under "Layout"; `write` merging and storing; `clear` back to defaults;
  text that is not JSON giving the defaults; a store that throws leaving
  the save working in memory; a config with a `Date` or a `write` field
  refused by name; the project name from `package.json` and from the
  folder.
- `pnpm lint` and `pnpm typecheck` pass, and `save.best = 1` and
  `save.write({ bets: 1 })` are compile errors.
- `pnpm dev` shows the Demo: a best beaten, the page reloaded, the best
  still there; Ⓑ held clears it.
- `pnpm dev 08-animation` still runs.

## Decisions made

- A default of `null` only accepts a stored `null`: the kinds must match.
- Two tabs of one game share a save; the last write wins.
- Stored text that is not JSON warns once with its own message; a store that
  throws (or cannot be made) warns once for the whole save, whichever of
  load, store or remove fails first, and the save keeps working in memory.
- The save holds its values deeply frozen, so a game cannot change one in
  place; `write` copies what it is given.
- `defineConfig` keeps the config as written, and `resolveConfig` checks
  that, since a defined config's `save` is the game's save, not the setting.
- `examples/04-text` told players Ⓐ was the Z key, from before slice 06
  moved the pad to A, S, W and D; its hint now says the A key.
