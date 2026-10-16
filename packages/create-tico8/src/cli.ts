// create-tico8 [dir]: makes a tico8 project folder.
import { spawn } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import type { Readable, Writable } from 'node:stream'
import { parseArgs } from 'node:util'
import { defaultTico8Spec, isEmptyDir, writeProject } from './create.ts'
import {
  detectPackageManager,
  installCommand,
  runCommand,
} from './package-manager.ts'

const usage = `Usage: create-tico8 [dir]

Makes a tico8 project in dir, installs it, and says how to run it.
`

const DEFAULT_NAME = 'my-game'

/** Everything `main` touches outside itself, so tests can stand in. */
export interface Io {
  stdin: Readable
  stdout: Writable
  stderr: Writable
  env: Record<string, string | undefined>
  /** True when stdin is a terminal, so prompts can be answered. */
  isTTY: boolean
  cwd: string
  /** Runs a command in `cwd` with the terminal attached; resolves its exit code. */
  run: (command: string[], cwd: string) => Promise<number>
}

/** Run a command with stdio inherited; a spawn failure counts as exit 1. */
function runInherited(command: string[], cwd: string): Promise<number> {
  const [file = '', ...args] = command
  return new Promise((done) => {
    const child = spawn(file, args, { cwd, stdio: 'inherit' })
    child.on('error', () => done(1))
    child.on('close', (code: number | null) => done(code ?? 1))
  })
}

/** The real terminal and process. */
export function processIo(): Io {
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    isTTY: Boolean(process.stdin.isTTY),
    cwd: process.cwd(),
    run: runInherited,
  }
}

/** Ask one question and return the trimmed answer. */
async function ask(io: Io, question: string): Promise<string> {
  const rl = createInterface({ input: io.stdin, output: io.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/** Make the project. Resolves the exit code; errors are one line on stderr. */
export async function main(args: string[], io: Io): Promise<number> {
  const say = (line: string) => io.stdout.write(`${line}\n`)
  const fail = (line: string) => {
    io.stderr.write(`${line}\n`)
    return 1
  }

  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(args)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  const { values, positionals } = parsed
  if (values.help) {
    io.stdout.write(usage)
    return 0
  }
  if (positionals.length > 1) {
    return fail(`Too many arguments.\n\n${usage.trimEnd()}`)
  }

  try {
    let dir = positionals[0]
    if (dir === undefined) {
      if (!io.isTTY) {
        return fail(
          'Missing project name. Pass it as an argument: create-tico8 <dir>',
        )
      }
      dir = (await ask(io, `Project name: (${DEFAULT_NAME}) `)) || DEFAULT_NAME
    }

    const target = resolve(io.cwd, dir)
    if (!isEmptyDir(target)) {
      if (!io.isTTY) {
        return fail(
          `${dir} is not empty. Pass an empty or new folder: create-tico8 <dir>`,
        )
      }
      const answer = await ask(
        io,
        `${dir} is not empty. Write into it anyway? (y/N) `,
      )
      if (!/^y(es)?$/i.test(answer)) return fail('Stopped.')
    }

    writeProject({
      dir: target,
      name: basename(target),
      tico8: values.tico8 ?? defaultTico8Spec(),
    })
    say(`Made ${dir}`)

    const pm = detectPackageManager(io.env.npm_config_user_agent)
    const install = installCommand(pm)
    say(`Installing with ${pm}...`)
    const installed = (await io.run(install, target)) === 0

    say('')
    if (!installed) {
      io.stderr.write(`${install.join(' ')} failed.\n`)
      say('Then:')
    } else {
      say('Next:')
    }
    say(`  cd ${dir}`)
    if (!installed) say(`  ${install.join(' ')}`)
    say(`  ${runCommand(pm, 'dev')}`)
    return 0
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

function parse(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      tico8: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
}

// Runs when started as the bin (workspace launcher, or built cli.js), not
// when a test imports this file.
if (
  /^(create-tico8|cli)(\.[cm]?[jt]s)?$/.test(basename(process.argv[1] ?? ''))
) {
  process.exitCode = await main(process.argv.slice(2), processIo())
}
