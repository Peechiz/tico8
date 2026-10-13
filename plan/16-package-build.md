# 16 — Package build

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

The newest example copied to a folder outside the workspace, with tico8
installed from a packed tarball, runs with `tico8 dev` and looks the same
as it does from source.

## Spec

`01-spec.md`: Platform, Name. `00-outline.md`: step 2, "Tooling".

Today the package's `exports` and `bin` point at TypeScript source. That
works in this workspace, but Node will not strip types from files under
`node_modules`, so an installed copy cannot run.

## Decide first

- Whether the browser side ships built, or as source for the game's own
  Vite to compile.
- Whether the workspace keeps running from source during development, with
  the build used only for packing.

## Task areas

- tsdown set up for the package: the CLI and Vite plugin for Node, the
  engine for the browser, and declaration files
- `exports`, `bin` and `files` in `package.json` pointing at the build
- `src/project.ts` kept a module of its own in the build, since the dev
  tool serves the project's config in its place by path
- `import.meta.hot` in the engine surviving the build
- A check that packs the package and runs an example against the tarball

## Check

To write with the tasks.

## Decisions made

None yet.
