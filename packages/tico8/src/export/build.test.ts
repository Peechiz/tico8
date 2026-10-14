import { fileURLToPath } from 'node:url'
import { beforeAll, expect, it } from 'vitest'
import { type BuiltGame, buildGame } from './build.ts'

const root = fileURLToPath(new URL('./fixtures/game', import.meta.url))

let game: BuiltGame

beforeAll(async () => {
  game = await buildGame({ root })
}, 60_000)

it('inlines the sheet and the sound as data URLs', () => {
  expect(game.js).toContain('data:image/png;base64,')
  expect(game.js).toContain('data:audio/')
})

it('leaves no sheet or sound address behind', () => {
  expect(game.js).not.toMatch(/["'`]\/sprites\//)
  expect(game.js).not.toMatch(/["'`]\/sounds\//)
})

it('inlines the UI font', () => {
  expect(game.js).toMatch(/data:font\/otf;base64,|data:[^"'`]*otf/)
})

it('is one module, with nothing loaded later', () => {
  expect(game.js).not.toContain('import(')
})

it("carries the game's CSS", () => {
  expect(game.css).toContain('.fixture-banner')
})
