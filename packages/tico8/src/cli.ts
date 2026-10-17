import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'
import { exportGame, formatSize, TypeCheckError } from './export/index.ts'
import { tico8 } from './vite.ts'

const usage = `Usage: tico8 <command>

Commands:
  dev [--port <number>]   Run the game in this folder, restarting it on save
  export [--out <file>] [--no-check]
                          Write the game as one HTML file, dist/<project>.html
`

/** Serve the project in the current folder until the process is stopped. */
async function dev(args: string[]) {
  const { values } = parseArgs({
    args,
    options: { port: { type: 'string' } },
  })
  const port = values.port === undefined ? undefined : Number(values.port)
  if (port !== undefined && !Number.isInteger(port)) {
    throw new Error(`--port must be a number, got "${values.port}"`)
  }

  const server = await createServer({
    root: process.cwd(),
    configFile: false,
    plugins: [tico8()],
    server: { port },
  })
  await server.listen()
  server.printUrls()

  process.once('SIGINT', async () => {
    await server.close()
    process.exit(0)
  })
}

/** Write the project in the current folder as one HTML file. */
async function exportCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      out: { type: 'string' },
      'no-check': { type: 'boolean' },
    },
  })
  const root = process.cwd()
  try {
    const { path, bytes, assets, warnings } = await exportGame({
      root,
      out: values.out,
      check: !values['no-check'],
    })
    const shown = relative(root, path)
    const where = shown.startsWith('..') ? path : shown
    console.log(`Wrote ${where} (${formatSize(bytes)})`)
    for (const asset of assets.slice(0, 5)) {
      console.log(`  ${asset.path}  ${formatSize(asset.bytes)}`)
    }
    for (const warning of warnings) console.warn(warning)
  } catch (error) {
    if (error instanceof TypeCheckError) console.error(error.output)
    throw error
  }
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  dev,
  export: exportCommand,
}

const [command, ...args] = process.argv.slice(2)
const run =
  command !== undefined && Object.hasOwn(commands, command)
    ? commands[command]
    : undefined

if (run) {
  try {
    await run(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
} else {
  if (command !== undefined) console.error(`Unknown command: ${command}\n`)
  console.error(usage)
  process.exit(1)
}
