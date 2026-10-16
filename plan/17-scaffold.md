# 17 — Scaffold

`npm create tico8` makes a project folder that runs, outside this repo,
from packed tarballs.

## Demo

`pnpm create:check --keep` makes `my-game` with the packed `create-tico8`
against the packed `tico8`. In that folder, `npm run dev` shows a sprite
moved with the arrow keys. `examples/17-scaffold` is the same starter
inside the workspace.

## Spec

`01-spec.md`: New projects, Name, Platform (the "Package" row).
`00-outline.md`: step 2.

`create-tico8` is built the way `tico8` is (slice 16): TypeScript source in
`src/` that the workspace runs, `dist/` in the packed copy through
`publishConfig`. The starter itself is plain files under `template/`,
shipped as they are.

## Layout

```
packages/create-tico8/
  package.json        bin create-tico8; files dist and template
  tsdown.config.ts
  src/cli.ts          arguments, prompts, install, next steps
  src/create.ts       writes the template into a folder
  src/package-manager.ts
  template/           the starter project; _gitignore becomes .gitignore
```

## Tasks

- [x] **1. Contract** *(contract)*. `packages/create-tico8/package.json`:
  name `create-tico8`, version `0.0.0` (tico8's), `private` like tico8,
  `type: module`; `bin.create-tico8` is `./bin/create-tico8.js` in the
  workspace (a two-line launcher importing `../src/cli.ts`, as tico8's is)
  and `./dist/cli.js` under `publishConfig`; `files` is
  `["dist", "template"]`; `build` runs tsdown (dev dependency). Exported
  types and empty functions:
  - `src/create.ts`: `interface CreateOptions { dir: string; name: string;
    tico8: string }` (`tico8` is the dependency spec written into the
    project, `^0.0.0` by default), `writeProject(options): void`,
    `isEmptyDir(dir): boolean`, `TEMPLATE_DIR`, and `defaultTico8Spec()`,
    which reads create-tico8's own version.
  - `src/package-manager.ts`: `type PackageManager = 'npm' | 'pnpm' |
    'yarn' | 'bun'`, `detectPackageManager(userAgent?: string)`,
    `installCommand(pm): string[]`, `runCommand(pm, script): string`
    (`npm run dev`, `pnpm dev`, `yarn dev`, `bun run dev`).
  - `bin/create-tico8.js`, `tsdown.config.ts` (one entry per `src` module,
    unbundled, `#!/usr/bin/env node` on `cli.js`).
  Owns: `packages/create-tico8/package.json`, `bin/`, `tsdown.config.ts`,
  the stub `src/create.ts` and `src/package-manager.ts`. Waits on: none.
- [x] **2. tico8's tsconfig.** `packages/tico8/tsconfig.game.json` holds
  the settings in `export/check.ts`'s `SETTINGS`, with no `include` or
  `files`, so a project's own folder is what gets checked. Exported as
  `tico8/tsconfig` in `exports` and `publishConfig.exports`, and listed in
  `files`. If TypeScript cannot resolve `extends` through `exports`, say
  so and fall back to `tico8/tsconfig.json`. The root `tsconfig.json`
  extends it and keeps its own `include` and `types`. `SETTINGS` stays,
  and a test checks it against the file.
  Test: a temp project inside the workspace whose `tsconfig.json` is
  `{ "extends": "tico8/tsconfig" }` and whose `main.tsx` uses JSX and
  `COLOR` passes `typeCheck`, and a type error in it fails.
  Owns: `packages/tico8/tsconfig.game.json`, `packages/tico8/package.json`,
  root `tsconfig.json`, `packages/tico8/src/export/check.ts` and its test.
  Waits on: none.
- [x] **3. Writer.** `writeProject` copies `template/` into `dir`
  (creating it), renames `_gitignore` to `.gitignore`, and sets
  `package.json`'s `name` to `name` and `dependencies.tico8` to `tico8`.
  It refuses a `name` npm would not accept. `isEmptyDir` is true for a
  missing folder and for one holding only `.git`.
  Test: writes into a temp folder; every template file is there, with the
  two changes; a bad name throws.
  Owns: `src/create.ts`, `src/create.test.ts`. Waits on: 1.
- [x] **4. CLI.** `create-tico8 [dir] [--tico8 <spec>]`. With no `dir`,
  asks "Project name:" through `node:readline` (default `my-game`). A
  non-empty folder asks "<dir> is not empty. Write into it anyway? (y/N)"
  and stops on anything but yes. Without a terminal (stdin not a TTY) a
  missing name or a non-empty folder is an error naming what to pass.
  The project's name is the folder's base name. Installs with the detected
  package manager, inheriting stdio; a failed install still prints the
  next step, with the install command first. Then prints `cd <dir>` and
  `runCommand(pm, 'dev')`. `--tico8` is for the checks and is left out of
  the usage text. `detectPackageManager` reads `npm_config_user_agent`,
  npm when it is missing or unknown.
  Test: `package-manager.test.ts` for detection and commands; `cli.test.ts`
  runs the CLI with stdin not a TTY and installing turned off by the test
  (an injected runner, not a public flag), for a name given, a name
  missing and a non-empty folder.
  Owns: `src/cli.ts`, `src/package-manager.ts`, their tests. Waits on: 1.
- [x] **5. Starter.** `packages/create-tico8/template/`: `package.json`
  (`private`, `type: module`, scripts `dev` and `export`, `tico8` as its
  only dependency, name `my-game`), `tsconfig.json` as
  `{ "extends": "tico8/tsconfig" }`, `tico8.config.ts` with the standard
  console (`defineConfig({})` and a short comment on what can go in it,
  exporting `COLOR` and `input`), `main.ts` moving one sprite with the
  arrow keys on a cleared screen, `sprites/player.png` (8x8 cells, a
  couple of walk frames) and the `sprites.ts` tico8 generates for it,
  and `_gitignore` (`node_modules`, `dist`). Short comments in `main.ts`
  point at what to change first.
  Test: `src/template.test.ts` draws the starter's first frame with the
  engine and compares the pixel buffer to a text picture (find how the
  sprite tests load a PNG).
  Owns: `packages/create-tico8/template/`, `src/template.test.ts`.
  Waits on: 1.
- [x] **6. Example.** `examples/17-scaffold`: the template, with
  `.gitignore` in place of `_gitignore`, its name `17-scaffold` and
  `tico8` as `workspace:*`. A test checks that every other file matches
  the template byte for byte.
  Owns: `examples/17-scaffold/`, `src/example.test.ts`. Waits on: 5.
- [x] **7. Create check.** `pnpm create:check` at the root: builds and
  packs `tico8` and `create-tico8`, then in a temp folder runs
  `npm exec --package=<create tarball> -- create-tico8 my-game --tico8
  file:<tico8 tarball>` with npm as the user agent, so the install is
  real. Then, as `pack:check` does: `tico8 export` with the type-check,
  and `tico8 dev`, fetching the pages and modules and failing on a non-200
  or anything on stderr. Then deletes `tico8.config.ts`, points `main.ts`
  at tico8's own `COLOR` and `input`, and runs the dev fetch again,
  checking the page is served the engine's `project.js` (the "Not
  checked" item in `05-config.md`). `--keep` keeps `my-game` and prints
  its path. Shared helpers move out of `scripts/pack-check.js` into
  `scripts/check-helpers.js`, and `pack:check` still passes.
  Owns: `scripts/create-check.js`, `scripts/check-helpers.js`,
  `scripts/pack-check.js`, the root `package.json`. Waits on: 2, 3, 4, 5.
- [x] **8. Wire up.** Lead only. `pnpm create:check --keep` passes; run
  `npm run dev` in the kept folder and see the sprite move in the browser.
  Waits on: 6, 7.

## Check

- `pnpm test` passes, including the starter's pixel test.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm pack:check` and `pnpm create:check` pass.
- `pnpm dev 17-scaffold` runs the starter from source.
- The demo runs from `pnpm create:check --keep`'s folder.

## Decisions made

- **Name:** kept as "tico8" for now. Nothing is published in this slice.
- **Editor settings:** extended from `tico8/tsconfig`, not copied in.
- **After copying:** install with the package manager that ran it, print
  the next step, no `git init`.
- **Missing name or non-empty folder:** asked in the terminal.
  `Project name: (my-game)`, and `<dir> is not empty. Write into it
  anyway? (y/N)`, which stops on anything but `y` or `yes`. Without a
  terminal either one is an error saying what to pass.
- **A failed install** keeps the project and exits 0, printing the steps
  to run with the install command first.
- **`--help`** prints the usage. `--tico8 <spec>` is for the checks and is
  left out of it.
- **Vite's types:** `tico8/client`, a types-only export the base tsconfig
  names in `types`. Its `vite/client` reference resolves from tico8's own
  folder, so pnpm projects get it too and can import CSS. Projects never
  name `vite/client` themselves.
- **Base tsconfig** (`tsconfig.game.json`, exported as `tico8/tsconfig`)
  sets `noEmit` and no `include`. The root `tsconfig.json` extends it by
  path. `export/check.ts`'s `SETTINGS` is tested against it.
- **The starter** has no `init`: the sprite is placed when it is made,
  walks on animation data with `hero.play`, and moves with `vec.move`.
  Its `sprites.ts` is the generator's own output.
- **Checks:** `scripts/check-helpers.js` is shared by `pack:check` and
  `create:check`, and both now follow served imports all the way down.
  `create:check` checks the no-config case in a copy, so the kept
  `my-game` is as `create-tico8` made it.
- **No config outside the repo:** the page is served the engine's
  `project.js` (closes the item in `05-config.md`'s "Not checked").
