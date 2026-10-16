// `pnpm pack:check` builds tico8, packs it, installs the tarball with npm into
// a copy of examples/16-package-build outside the workspace, then runs
// `tico8 export` and `tico8 dev` there. `--keep` leaves the folder in place.
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAndPack, devCheck, root, run, step } from './check-helpers.js'

const keep = process.argv.includes('--keep')
const temp = mkdtempSync(join(tmpdir(), 'tico8-pack-check-'))
const project = join(temp, 'project')

async function main() {
  const tarball = buildAndPack('tico8', join(temp, 'pack'))

  step('copying examples/16-package-build and installing with npm')
  cpSync(join(root, 'examples/16-package-build'), project, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist)$/.test(src),
  })
  const manifestPath = join(project, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies.tico8 = `file:${tarball}`
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  run('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: project,
    label: 'npm install',
  })

  step('tico8 export')
  run('npx', ['tico8', 'export'], { cwd: project, label: 'tico8 export' })

  step('tico8 dev')
  await devCheck(project)
}

let failure
try {
  await main()
} catch (error) {
  failure = error
} finally {
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
