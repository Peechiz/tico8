import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

export interface CheckOptions {
  /** The project folder. */
  root: string
}

export interface CheckResult {
  /** How many type errors tsc found. */
  errors: number
  /** What tsc printed. */
  output: string
}

const require = createRequire(import.meta.url)

/** tico8's settings, as the workspace's root `tsconfig.json`. */
const SETTINGS = [
  '--target',
  'ES2023',
  '--lib',
  'ES2023,DOM',
  '--module',
  'ESNext',
  '--moduleResolution',
  'bundler',
  '--strict',
  '--noUncheckedIndexedAccess',
  '--jsx',
  'react-jsx',
  '--jsxImportSource',
  'tico8/ui',
  '--allowImportingTsExtensions',
  '--verbatimModuleSyntax',
  '--erasableSyntaxOnly',
  '--skipLibCheck',
  '--types',
  '',
]

/**
 * Type-check a project with the TypeScript that comes with tico8: its own
 * `tsconfig.json` when it has one, tico8's settings otherwise.
 */
export async function typeCheck({ root }: CheckOptions): Promise<CheckResult> {
  const tsc = join(
    dirname(require.resolve('typescript/package.json')),
    'bin',
    'tsc',
  )
  const args = [tsc, '--noEmit', '--pretty', ...projectArgs(root)]
  const { code, output } = await run(args, root)
  const counted = output.replace(ANSI, '').match(/\berror TS\d+:/g)?.length ?? 0
  return { errors: code === 0 ? counted : Math.max(counted, 1), output }
}

function projectArgs(root: string): string[] {
  const config = join(root, 'tsconfig.json')
  if (existsSync(config)) return ['-p', config]
  const main = ['main.tsx', 'main.ts'].find((name) =>
    existsSync(join(root, name)),
  )
  if (!main) throw new Error(`No main.tsx or main.ts in ${root}`)
  // Engine source uses `import.meta.hot`. Vite's client types come from
  // tico8's own Vite, which a pnpm project cannot resolve from its folder.
  const viteClient = join(
    dirname(require.resolve('vite/package.json')),
    'client.d.ts',
  )
  return ['--ignoreConfig', ...SETTINGS, main, viteClient]
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: matches terminal colour codes
const ANSI = /\u001b\[[0-9;]*m/g

function run(
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}
