import { describe, expect, it, vi } from 'vitest'
import {
  detectPackageManager,
  installCommand,
  runCommand,
} from './package-manager.ts'

describe('detectPackageManager', () => {
  it('reads the first token of the user agent', () => {
    expect(detectPackageManager('pnpm/10.33.0 npm/? node/v25.9.0 darwin')).toBe(
      'pnpm',
    )
    expect(detectPackageManager('yarn/4.1.0 npm/? node/v22')).toBe('yarn')
    expect(detectPackageManager('bun/1.2.0 npm/? node/v22')).toBe('bun')
    expect(detectPackageManager('npm/10.0.0 node/v22')).toBe('npm')
  })

  it('falls back to npm when missing or unknown', () => {
    vi.stubEnv('npm_config_user_agent', '')
    expect(detectPackageManager()).toBe('npm')
    vi.unstubAllEnvs()
    expect(detectPackageManager('')).toBe('npm')
    expect(detectPackageManager('deno/2.0.0 npm/?')).toBe('npm')
  })
})

describe('commands', () => {
  it('installs with the manager', () => {
    expect(installCommand('npm')).toEqual(['npm', 'install'])
    expect(installCommand('pnpm')).toEqual(['pnpm', 'install'])
  })

  it('runs scripts the way each manager spells it', () => {
    expect(runCommand('npm', 'dev')).toBe('npm run dev')
    expect(runCommand('pnpm', 'dev')).toBe('pnpm dev')
    expect(runCommand('yarn', 'dev')).toBe('yarn dev')
    expect(runCommand('bun', 'dev')).toBe('bun run dev')
  })
})
