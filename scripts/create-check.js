// `pnpm create:check` builds and packs tico8 and create-tico8, then outside
// the workspace runs the packed create-tico8 through `npm exec` to make
// `my-game` against the packed tico8, installed for real by npm. It runs
// `tico8 export` and `tico8 dev` in it, then the dev check again in a copy
// with no `tico8.config.ts`. `--keep` leaves the folder in place.
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAndPack, devCheck, run, step } from './check-helpers.js'

const keep = process.argv.includes('--keep')
const temp = mkdtempSync(join(tmpdir(), 'tico8-create-check-'))
const project = join(temp, 'my-game')
const noConfig = join(temp, 'no-config')

/**
 * This process's environment without what pnpm adds (`npm_*`), so npm
 * starts clean, with npm as the user agent create-tico8 detects.
 */
function npmEnv() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key)),
  )
  env.npm_config_user_agent = `npm/10 node/${process.version} ${process.platform} ${process.arch}`
  return env
}

/** An import of the project's config, as the dev tool rewrites it. */
const importsConfig = (code) => /from\s*["']\/tico8\.config\.ts/.test(code)

/** The engine's `project.js` among the served modules: [path, body]. */
function projectModule(served) {
  const found = [...served].find(([path]) =>
    /\/tico8\/dist\/project\.js(\?|$)/.test(path),
  )
  if (found === undefined) {
    throw new Error(
      `the page never loaded tico8's dist/project.js. Served:\n    ${[...served.keys()].join('\n    ')}`,
    )
  }
  return found
}

async function main() {
  const packs = join(temp, 'pack')
  const tico8 = buildAndPack('tico8', packs)
  const create = buildAndPack('create-tico8', packs)

  step('npm exec create-tico8 my-game')
  // stdin is a pipe, not a terminal, so nothing can be asked.
  const made = spawnSync(
    'npm',
    [
      'exec',
      '--yes',
      `--package=${create}`,
      '--',
      'create-tico8',
      'my-game',
      '--tico8',
      `file:${tico8}`,
    ],
    { cwd: temp, env: npmEnv(), encoding: 'utf8', input: '' },
  )
  process.stdout.write(made.stdout ?? '')
  if (made.status !== 0) {
    process.stderr.write(made.stderr ?? '')
    throw new Error(`create-tico8 failed (exit ${made.status ?? made.signal})`)
  }
  const next = ['Next:', '  cd my-game', '  npm run dev']
  const lines = made.stdout.split('\n')
  const at = lines.indexOf(next[0])
  if (at < 0 || next.some((line, i) => lines[at + i] !== line)) {
    throw new Error(
      `create-tico8 did not print the next steps:\n${next.join('\n')}`,
    )
  }

  step('tico8 export')
  run('npx', ['tico8', 'export'], { cwd: project, label: 'tico8 export' })

  step('tico8 dev')
  const [path, body] = projectModule(await devCheck(project))
  if (!importsConfig(body)) {
    throw new Error(`${path} does not hand over tico8.config.ts:\n${body}`)
  }
  console.log(`    ${path} is the project's config`)

  step('tico8 dev with no tico8.config.ts (in a copy)')
  cpSync(project, noConfig, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => src !== join(project, 'dist'),
  })
  rmSync(join(noConfig, 'tico8.config.ts'))
  const mainPath = join(noConfig, 'main.ts')
  const code = readFileSync(mainPath, 'utf8')
  const pattern = /^import \{ COLOR, input \} from '\.\/tico8\.config'$/m
  if (!pattern.test(code)) {
    throw new Error(
      "main.ts has no import { COLOR, input } from './tico8.config'",
    )
  }
  writeFileSync(
    mainPath,
    code.replace(pattern, "import { COLOR, input } from 'tico8'"),
  )
  const [emptyPath, empty] = projectModule(await devCheck(noConfig))
  if (importsConfig(empty) || !/const project = \{\}/.test(empty)) {
    throw new Error(`${emptyPath} is not the engine's empty config:\n${empty}`)
  }
  console.log(`    ${emptyPath} is the engine's empty config`)
}

let failure
try {
  await main()
} catch (error) {
  failure = error
} finally {
  if (keep) {
    console.log(`\nKept: ${temp}\nRun it: cd ${project} && npm run dev`)
  } else {
    rmSync(temp, { recursive: true, force: true })
  }
}

if (failure) {
  console.error(`\nFAIL: ${failure.message}`)
  process.exit(1)
}
console.log(
  '\nPASS: the packed create-tico8 makes a project that exports and serves',
)
