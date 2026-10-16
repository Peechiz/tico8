import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Io, main } from './cli.ts'
import { isEmptyDir, writeProject } from './create.ts'

vi.mock('./create.ts', () => ({
  writeProject: vi.fn(),
  isEmptyDir: vi.fn(() => true),
  defaultTico8Spec: () => '^0.0.0',
}))

function capture(stream: PassThrough) {
  let text = ''
  stream.on('data', (chunk) => {
    text += chunk
  })
  return () => text
}

function setup(overrides: Partial<Io> = {}, userAgent = 'pnpm/10.0.0 npm/?') {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const out = capture(stdout)
  const err = capture(stderr)
  const run = vi.fn(async () => 0)
  const io: Io = {
    stdin: new PassThrough(),
    stdout,
    stderr,
    env: { npm_config_user_agent: userAgent },
    isTTY: false,
    cwd: '/work',
    run,
    ...overrides,
  }
  return { io, out, err, run }
}

beforeEach(() => {
  vi.mocked(writeProject).mockClear()
  vi.mocked(isEmptyDir).mockReturnValue(true)
})

describe('create-tico8', () => {
  it('writes, installs and prints the next steps for a given name', async () => {
    const { io, out, run } = setup()
    expect(await main(['cool-game'], io)).toBe(0)
    expect(writeProject).toHaveBeenCalledWith({
      dir: '/work/cool-game',
      name: 'cool-game',
      tico8: '^0.0.0',
    })
    expect(run).toHaveBeenCalledWith(['pnpm', 'install'], '/work/cool-game')
    expect(out()).toContain('  cd cool-game\n  pnpm dev\n')
  })

  it('names the project after the folder and passes --tico8', async () => {
    const { io } = setup()
    await main(['games/a-game', '--tico8', 'file:x.tgz'], io)
    expect(writeProject).toHaveBeenCalledWith({
      dir: '/work/games/a-game',
      name: 'a-game',
      tico8: 'file:x.tgz',
    })
  })

  it('errors on a missing name without a terminal', async () => {
    const { io, err } = setup()
    expect(await main([], io)).toBe(1)
    expect(err()).toBe(
      'Missing project name. Pass it as an argument: create-tico8 <dir>\n',
    )
    expect(writeProject).not.toHaveBeenCalled()
  })

  it('errors on a non-empty folder without a terminal', async () => {
    vi.mocked(isEmptyDir).mockReturnValue(false)
    const { io, err } = setup()
    expect(await main(['busy'], io)).toBe(1)
    expect(err()).toContain('busy is not empty. Pass an empty or new folder')
    expect(writeProject).not.toHaveBeenCalled()
  })

  it('asks for the name in a terminal, defaulting to my-game', async () => {
    const stdin = new PassThrough()
    const { io, out } = setup({ stdin, isTTY: true })
    stdin.end('\n')
    expect(await main([], io)).toBe(0)
    expect(out()).toContain('Project name:')
    expect(vi.mocked(writeProject).mock.calls[0]?.[0].name).toBe('my-game')
  })

  it('asks before writing into a non-empty folder and stops on no', async () => {
    vi.mocked(isEmptyDir).mockReturnValue(false)
    const stdin = new PassThrough()
    const { io, out } = setup({ stdin, isTTY: true })
    stdin.end('n\n')
    expect(await main(['busy'], io)).toBe(1)
    expect(out()).toContain('busy is not empty. Write into it anyway? (y/N)')
    expect(writeProject).not.toHaveBeenCalled()
  })

  it('writes into a non-empty folder on yes', async () => {
    vi.mocked(isEmptyDir).mockReturnValue(false)
    const stdin = new PassThrough()
    const { io } = setup({ stdin, isTTY: true })
    stdin.end('y\n')
    expect(await main(['busy'], io)).toBe(0)
    expect(writeProject).toHaveBeenCalled()
  })

  it('still prints the next steps when the install fails', async () => {
    const { io, out, err } = setup({ run: async () => 1 }, 'npm/10.0.0')
    expect(await main(['g'], io)).toBe(0)
    expect(err()).toContain('npm install failed.')
    expect(out()).toContain('  cd g\n  npm install\n  npm run dev\n')
  })

  it('reports a writer error as one line', async () => {
    vi.mocked(writeProject).mockImplementationOnce(() => {
      throw new Error('Bad name "X"')
    })
    const { io, err } = setup()
    expect(await main(['X'], io)).toBe(1)
    expect(err()).toBe('Bad name "X"\n')
  })

  it('leaves --tico8 out of the usage text', async () => {
    const { io, out } = setup()
    expect(await main(['--help'], io)).toBe(0)
    expect(out()).toContain('Usage: create-tico8')
    expect(out()).not.toContain('--tico8')
  })
})
