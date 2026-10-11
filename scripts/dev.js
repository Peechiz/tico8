// `pnpm dev` runs the newest example; `pnpm dev 02-sprite` runs a named one.
// Anything after the name goes to `tico8 dev`: `pnpm dev 02-sprite --port 4000`.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const names = readdirSync('examples')
  .filter((name) => !name.startsWith('.'))
  .sort()
const args = process.argv.slice(2).filter((arg) => arg !== '--')
const name = args[0]?.startsWith('-') === false ? args.shift() : names.at(-1)
if (!names.includes(name)) {
  console.error(`No example "${name}". Available:\n  ${names.join('\n  ')}`)
  process.exit(1)
}
const { status } = spawnSync('pnpm', ['--filter', name, 'dev', ...args], {
  stdio: 'inherit',
})
process.exit(status ?? 1)
