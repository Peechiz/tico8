// `pnpm pack:check` builds tico8, packs it, installs the tarball with npm into
// a copy of examples/16-package-build outside the workspace, then runs
// `tico8 export` and `tico8 dev` there. `--keep` leaves the folder in place.
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const keep = process.argv.includes('--keep')
const root = resolve(import.meta.dirname, '..')
const temp = mkdtempSync(join(tmpdir(), 'tico8-pack-check-'))
const project = join(temp, 'project')
let server

const step = (text) => console.log(`\n==> ${text}`)

function run(command, args, cwd, label) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${label} failed (exit ${result.status ?? result.signal})`)
  }
  return result.stdout
}

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer()
    probe.once('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => done(port))
    })
  })
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function waitFor(base, log) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) {
      throw new Error(`tico8 dev exited early (${server.exitCode})\n${log()}`)
    }
    try {
      if ((await fetch(`${base}/`)).status === 200) return
    } catch {}
    await sleep(500)
  }
  throw new Error(`tico8 dev never answered\n${log()}`)
}

// Module specifiers that start with "/" in a served module.
const importsOf = (code) =>
  [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/[^"']+)["']/g)].map(
    (m) => m[1],
  )

async function fetchAll(base) {
  const failures = []
  const seen = new Set()
  const get = async (path) => {
    if (seen.has(path)) return ''
    seen.add(path)
    const response = await fetch(base + path)
    const body = await response.text()
    console.log(`    ${response.status} ${path}`)
    if (response.status !== 200) failures.push(`${response.status} ${path}`)
    return body
  }
  await get('/')
  await get('/@tico8/game')
  const entry = await get('/@tico8/entry.js')
  const shell = await get('/@tico8/shell.js')
  const main = importsOf(entry).find((p) => /main\.tsx/.test(p)) ?? '/main.tsx'
  await get(main)
  for (const path of importsOf(shell)) await get(path)
  if (failures.length)
    throw new Error(`non-200 responses: ${failures.join(', ')}`)
}

async function main() {
  step('building tico8')
  run('pnpm', ['--filter', 'tico8', 'build'], root, 'build')

  step('packing tico8')
  const packDir = join(temp, 'pack')
  cpSync(root, packDir, { filter: () => false }) // creates the folder
  run(
    'pnpm',
    ['pack', '--pack-destination', packDir],
    join(root, 'packages/tico8'),
    'pack',
  )
  const tarball = join(
    packDir,
    readdirSync(packDir).find((f) => f.endsWith('.tgz')),
  )
  console.log(`    ${tarball}`)

  step('copying examples/16-package-build and installing with npm')
  cpSync(join(root, 'examples/16-package-build'), project, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist)$/.test(src),
  })
  const manifestPath = join(project, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies.tico8 = `file:${tarball}`
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  run('npm', ['install', '--no-audit', '--no-fund'], project, 'npm install')

  step('tico8 export')
  run('npx', ['tico8', 'export'], project, 'tico8 export')

  step('tico8 dev')
  const port = await freePort()
  let output = ''
  let errors = ''
  server = spawn(
    join(project, 'node_modules/.bin/tico8'),
    ['dev', '--port', String(port)],
    {
      cwd: project,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const collect = (chunk) => {
    output += chunk
  }
  server.stdout.on('data', collect)
  // Vite writes warnings and errors, tico8's among them, to stderr.
  server.stderr.on('data', (chunk) => {
    collect(chunk)
    errors += chunk
  })
  const base = `http://localhost:${port}`
  await waitFor(base, () => output)
  console.log(`    answering on ${base}`)
  await fetchAll(base)
  await sleep(500)
  if (errors.trim()) throw new Error(`dev server reported:\n${errors}`)
}

let failure
try {
  await main()
} catch (error) {
  failure = error
} finally {
  server?.kill()
  if (keep) {
    console.log(`\nKept: ${project}\nRun it: cd ${project} && npx tico8 dev`)
  } else {
    rmSync(temp, { recursive: true, force: true })
  }
}

if (failure) {
  console.error(`\nFAIL: ${failure.message}`)
  process.exit(1)
}
console.log('\nPASS: the packed tico8 exports and serves the example')
