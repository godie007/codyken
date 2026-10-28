import { describe, expect, it } from 'vitest'
import { buildEnv, git } from '../src/main/git'

const SEP = process.platform === 'win32' ? ';' : ':'

/** PATH devuelto por buildEnv, venga como `Path` o como `PATH`. */
function pathOf(env: NodeJS.ProcessEnv): string {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  return env[key] ?? ''
}

describe('buildEnv', () => {
  it('conserva el PATH del sistema', () => {
    const original = pathOf(process.env).split(SEP).filter(Boolean)
    expect(original.length).toBeGreaterThan(0)
    expect(pathOf(buildEnv()).split(SEP)).toContain(original[0])
  })

  it('no mezcla rutas de la otra plataforma', () => {
    const value = pathOf(buildEnv())
    if (process.platform === 'win32') expect(value).not.toContain('/opt/homebrew/bin')
    else expect(value).not.toContain('Git\\cmd')
  })

  it('encuentra git desde el proyecto', async () => {
    const out = await git(process.cwd(), ['rev-parse', '--is-inside-work-tree'])
    expect(out.trim()).toBe('true')
  })
})
