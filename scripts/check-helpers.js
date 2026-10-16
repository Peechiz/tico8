// What `pack:check` and `create:check` share: running commands, building and
// packing a workspace package, and running `tico8 dev` and fetching what it
// serves.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'

/** The workspace root. */
export const root = resolve(import.meta.dirname, '..')

export const step = (text) => console.log(`\n==> ${text}`)

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * Run a command and give its stdout. On a non-zero exit, print what it
 * wrote and throw. `env` replaces the environment when given.
 */
export function run(command, args, { cwd, label = command, env } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' })
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${label} failed (exit ${result.status ?? result.signal})`)
  }
  return result.stdout
}

/**
 * Build a workspace package (`packages/<name>`) and pack it into a folder of
 * its own under `into`. Gives the tarball's path.
 */
export function buildAndPack(name, into) {
  step(`building ${name}`)
  run('pnpm', ['--filter', name, 'build'], { cwd: root, label: 'build' })

  step(`packing ${name}`)
  const dir = join(into, name)
  mkdirSync(dir, { recursive: true })
  run('pnpm', ['pack', '--pack-destination', dir], {
    cwd: join(root, 'packages', name),
    label: 'pack',
  })
  const file = readdirSync(dir).find((f) => f.endsWith('.tgz'))
  if (file === undefined) throw new Error(`pnpm pack made no tarball in ${dir}`)
  const tarball = join(dir, file)
  console.log(`    ${tarball}`)
  return tarball
}

export function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer()
    probe.once('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => done(port))
    })
  })
}

/**
 * Start the project's own `tico8 dev` on a free port and wait until it
 * answers. Gives its address, what it wrote to stderr so far, and a stop.
 */
export async function startDev(project) {
  const port = await freePort()
  let output = ''
  let errors = ''
  let failed
  const server = spawn(
    join(project, 'node_modules/.bin/tico8'),
    ['dev', '--port', String(port)],
    { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  server.on('error', (error) => {
    failed = error
  })
  server.stdout.on('data', (chunk) => {
    output += chunk
  })
  // Vite writes warnings and errors, tico8's among them, to stderr.
  server.stderr.on('data', (chunk) => {
    output += chunk
    errors += chunk
  })
  const dev = {
    base: `http://localhost:${port}`,
    errors: () => errors,
    stop: () => server.kill(),
  }
  try {
    for (let i = 0; ; i++) {
      if (failed) throw new Error(`tico8 dev did not start: ${failed.message}`)
      if (server.exitCode !== null) {
        throw new Error(
          `tico8 dev exited early (${server.exitCode})\n${output}`,
        )
      }
      if (i === 120) throw new Error(`tico8 dev never answered\n${output}`)
      try {
        if ((await fetch(`${dev.base}/`)).status === 200) break
      } catch {}
      await sleep(500)
    }
  } catch (error) {
    dev.stop()
    throw error
  }
  console.log(`    answering on ${dev.base}`)
  return dev
}

/**
 * Run `tico8 dev` in the project, fetch everything with `fetchAll`, then
 * fail on anything the server wrote to stderr. Gives what was fetched.
 */
export async function devCheck(project) {
  const dev = await startDev(project)
  try {
    const served = await fetchAll(dev.base)
    await sleep(500)
    if (dev.errors().trim()) {
      throw new Error(`dev server reported:\n${dev.errors()}`)
    }
    return served
  } finally {
    dev.stop()
  }
}

/** Module specifiers that start with "/" in a served module. */
const importsOf = (code) =>
  [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/[^"']+)["']/g)].map(
    (m) => m[1],
  )

/**
 * Fetch the dev pages, then every module they load, following imports.
 * Throws on any non-200. Gives each path's body, by path.
 */
export async function fetchAll(base) {
  const failures = []
  const served = new Map()
  const get = async (path, follow) => {
    if (served.has(path)) return
    served.set(path, '')
    const response = await fetch(base + path)
    const body = await response.text()
    served.set(path, body)
    if (response.status !== 200) {
      console.log(`    ${response.status} ${path}`)
      failures.push(`${response.status} ${path}`)
      return
    }
    if (follow) for (const next of importsOf(body)) await get(next, true)
  }
  await get('/', false)
  await get('/@tico8/game', false)
  await get('/@tico8/entry.js', true)
  await get('/@tico8/shell.js', true)
  console.log(`    ${served.size} pages and modules`)
  if (failures.length)
    throw new Error(`non-200 responses: ${failures.join(', ')}`)
  return served
}
