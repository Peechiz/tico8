/** The package managers `npm create`-style commands can come from. */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const managers: readonly string[] = ['npm', 'pnpm', 'yarn', 'bun']

/**
 * The package manager that ran this, from `npm_config_user_agent`
 * (`pnpm/10.33.0 npm/? node/v25.9.0 darwin arm64`). npm when it is missing
 * or unknown.
 */
export function detectPackageManager(
  userAgent: string | undefined = process.env.npm_config_user_agent,
): PackageManager {
  const name = userAgent?.trim().split(/\s+/)[0]?.split('/')[0]
  return name !== undefined && managers.includes(name)
    ? (name as PackageManager)
    : 'npm'
}

/** The command and arguments that install a project: `['npm', 'install']`. */
export function installCommand(pm: PackageManager): string[] {
  return [pm, 'install']
}

/** How a user runs a script with it: `npm run dev`, `pnpm dev`. */
export function runCommand(pm: PackageManager, script: string): string {
  return pm === 'npm' || pm === 'bun'
    ? `${pm} run ${script}`
    : `${pm} ${script}`
}
