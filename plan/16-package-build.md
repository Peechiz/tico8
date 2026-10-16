# 16 — Package build

tico8 packed into a tarball that runs from `node_modules`, while the
workspace keeps running its TypeScript source.

## Demo

`examples/16-package-build`, copied to a folder outside the workspace, with
tico8 installed from a packed tarball, runs with `tico8 dev` and looks the
same as it does from source.

## Spec

`01-spec.md`: Platform (the "Package" row), Name. `00-outline.md`: step 2,
"Tooling".

Node will not strip types from files under `node_modules`, so the packed
copy must be JavaScript. `pnpm pack` applies `publishConfig`, which points
`exports` and `bin` at `dist/`; the workspace's own fields stay on `src/`.

## Tasks

- [x] **1. Contract** *(contract)*. `packages/tico8/package.json`: `files`
  is `["dist"]`; `publishConfig.exports` gives each entry point a `types`
  and a `default` under `dist/` (`./src/ui/index.ts` becomes
  `./dist/ui/index.js` and `./dist/ui/index.d.ts`); `publishConfig.bin` is
  `./dist/cli.js`; the `build` script runs tsdown, a dev dependency.
  The build layout follows: `dist/` mirrors `src/` one module per file,
  `.ts`/`.tsx` becoming `.js`.
  Owns: `packages/tico8/package.json`. Waits on: none.
- [x] **2. Build.** tsdown set up for the package, unbundled, so every
  non-test source file under `src/` becomes its own module in `dist/` and
  `dist/project.js` stays a module of its own. Engine JSX compiles through
  `tico8/ui`. `vite`, `typescript`, `preact` and `tico8` itself stay
  imports. `import.meta.hot` and `new URL(..., import.meta.url)` come
  through untouched, and `ui/tico8.otf` is copied beside `dist/ui/font.js`.
  `dist/cli.js` starts with a `#!/usr/bin/env node` line. Declaration files
  for every entry point, with relative imports ending `.js`; if tsdown
  cannot drive TypeScript 7 for them, `tsc --emitDeclarationOnly` with
  `rewriteRelativeImportExtensions` in the build script instead.
  Test: builds into a temp folder, imports the built `index.js`, draws with
  it and compares the pixel buffer to a text picture; checks that
  `project.js`, `assets/sheets.js` (still reading `import.meta.hot`),
  `ui/tico8.otf` and a `.d.ts` per entry point are there.
  Owns: `packages/tico8/tsdown.config.ts`, `packages/tico8/src/build.test.ts`,
  and `packages/tico8/tsconfig.build.json` if one is needed. Waits on: 1.
- [x] **3. Paths that name source files.** The Node side names two engine
  files by path: `project.ts` (served in the project config's place) and
  `editor/main.tsx` (the dev page's module). Built, they are `project.js`
  and `editor/main.js`. A helper finds a module by its source path,
  whichever of source or build sits beside the caller, and both places use
  it; `isProjectModule` matches `project.js` as well as `project.ts`.
  Owns: `src/module-path.ts` and its test, `src/vite.ts`,
  `src/vite/config.ts`, their tests. Waits on: 1.
- [x] **4. Pack check.** `pnpm pack:check` at the root: builds the package,
  packs it with `pnpm pack`, copies `examples/16-package-build` to a temp
  folder outside the workspace, points its `tico8` dependency at the
  tarball, installs with npm, then runs `tico8 export` (type-check on, so
  the `.d.ts` files are used) and `tico8 dev` on a free port, fetching the
  dev page, the game page, the entry module and the game's main module and
  failing on anything but a 200. Leaves the folder in place and prints its
  path with `--keep`, for the demo.
  Owns: `scripts/pack-check.js`, the root `package.json`. Waits on: 1.
- [x] **5. Example.** `examples/16-package-build`, a copy of
  `examples/15-map-editor` with its name changed.
  Owns: `examples/16-package-build/`. Waits on: none.
- [x] **6. Wire up.** Lead only. `pnpm pack:check` passes; run the demo
  from the kept folder in the browser.
  Waits on: 2, 3, 4, 5.

## Check

- `pnpm test` passes, including the build test drawing with the built
  engine.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm pack:check` passes.
- `pnpm dev` still runs from source, with no build first.
- The demo, run from `pnpm pack:check --keep`'s folder, matches
  `pnpm dev 16-package-build`.

## Decisions made

- **Ships built:** JavaScript and `.d.ts` files in `dist/`, one module per
  source file, for Node and the browser alike.
- **Workspace runs source:** `exports` and `bin` stay on `src/`;
  `publishConfig` points them at `dist/` in the packed copy only. No watch
  build during development.
- **Declarations:** tsdown writes them itself (it drives TypeScript 7's Go
  compiler), one `.d.ts` per module, not only per entry point.
- **Left out of `dist/`:** tests, `src/testing.ts` (only tests use it) and
  the export fixtures.
- **Finding engine files by path:** `modulePath` takes the source path and
  falls back to the `.js` beside it; source wins when both exist.
- **Pack check:** installs the tarball with npm, as a user would, runs
  `tico8 export` with the type-check, and fetches the dev pages and modules.
  Anything the dev server writes to stderr fails it.
