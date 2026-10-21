import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { divergence, fastForward, fetch, getRebaseCommits, getRefs, interactiveRebase, merge, moveBranch, pushBranch } from '../src/main/git'

let root = ''
let dir = ''
let origin = ''
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const commit = (file: string, content: string, message: string): string => {
  writeFileSync(join(dir, file), content)
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}
const at = (ref: string): string => git('rev-parse', ref)
const remoteAt = (branch: string): string => execFileSync('git', ['rev-parse', `refs/heads/${branch}`], { cwd: origin, encoding: 'utf8' }).trim()

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'codyken-ramas-'))
  dir = join(root, 'repo')
  origin = join(root, 'origin.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['init', '-q', '-b', 'main', dir])
  git('config', 'user.email', 'ana@x.co')
  git('config', 'user.name', 'Ana')
  git('remote', 'add', 'origin', origin)
  commit('a.txt', 'a\n', 'base')
  git('push', '-q', '-u', 'origin', 'main')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('operaciones de arrastrar y soltar', () => {
  it('cuenta los commits que tiene cada rama y no la otra', async () => {
    git('checkout', '-q', '-b', 'feature')
    commit('f1.txt', '1\n', 'f1')
    commit('f2.txt', '2\n', 'f2')
    git('checkout', '-q', 'main')
    expect(await divergence(dir, 'refs/heads/feature', 'refs/heads/main')).toEqual({ ahead: 2, behind: 0 })
    expect(await divergence(dir, 'refs/heads/main', 'refs/heads/feature')).toEqual({ ahead: 0, behind: 2 })
  })

  it('hace fast-forward de una rama que no es la actual y la devuelve a su sitio', async () => {
    git('branch', 'copia', 'main')
    const before = at('copia')
    await fastForward(dir, 'copia', 'refs/heads/feature')
    expect(at('copia')).toBe(at('feature'))
    expect(git('branch', '--show-current')).toBe('main')
    await moveBranch(dir, 'copia', before)
    expect(at('copia')).toBe(before)
  })

  it('hace fast-forward de la rama actual y rechaza un avance que no es directo', async () => {
    git('checkout', '-q', '-b', 'actual', 'main')
    await fastForward(dir, 'actual', 'refs/heads/feature')
    expect(at('HEAD')).toBe(at('feature'))
    git('checkout', '-q', 'main')
    commit('m.txt', 'm\n', 'solo en main')
    await expect(fastForward(dir, 'feature', 'refs/heads/main')).rejects.toThrow('no se puede hacer fast-forward')
  })

  it('no mueve con moveBranch la rama en la que estás', async () => {
    await expect(moveBranch(dir, 'main', 'refs/heads/feature')).rejects.toThrow()
  })

  it('sube una rama que no es la actual y la deja siguiendo a la remota', async () => {
    await pushBranch(dir, 'feature', 'origin', 'feature', { setUpstream: true })
    expect(remoteAt('feature')).toBe(at('feature'))
    git('fetch', '-q')
    const feature = (await getRefs(dir)).find((r) => r.type === 'local' && r.name === 'feature')
    expect(feature?.upstream).toBe('origin/feature')
  })

  it('sube una rama local a otra rama remota y exige forzar si divergen', async () => {
    // main tiene "solo en main" y origin/main no: avance directo
    await pushBranch(dir, 'main', 'origin', 'main', {})
    expect(remoteAt('main')).toBe(at('main'))
    // feature no contiene main: subirla encima de origin/main no es un avance directo
    await expect(pushBranch(dir, 'feature', 'origin', 'main', {})).rejects.toThrow()
    git('fetch', '-q')
    await pushBranch(dir, 'feature', 'origin', 'main', { force: true })
    expect(remoteAt('main')).toBe(at('feature'))
    await pushBranch(dir, 'main', 'origin', 'main', { force: true })
  })

  it('rechaza remotos y nombres de rama no válidos', async () => {
    await expect(pushBranch(dir, 'feature', 'nadie', 'feature', {})).rejects.toThrow('No existe el remoto')
    await expect(pushBranch(dir, '--force', 'origin', 'x', {})).rejects.toThrow('no válido')
  })
})

describe('rebase interactivo sobre otra rama', () => {
  it('lista los commits propios de la rama y los lleva encima de la otra', async () => {
    git('checkout', '-q', '-b', 'tema', 'main~1')
    commit('t1.txt', 't1\n', 'tema uno')
    commit('t2.txt', 't2\n', 'tema dos')
    git('checkout', '-q', 'main')

    const commits = await getRebaseCommits(dir, 'refs/heads/main', 'onto', 'refs/heads/tema')
    expect(commits.map((c) => c.subject)).toEqual(['tema uno', 'tema dos'])

    git('checkout', '-q', 'tema')
    await interactiveRebase(dir, 'refs/heads/main', [
      { hash: commits[1].hash, action: 'pick' },
      { hash: commits[0].hash, action: 'reword', message: 'tema uno, reescrito' }
    ], 'onto')
    expect(git('log', '--format=%s', 'main..tema').split('\n')).toEqual(['tema uno, reescrito', 'tema dos'])
    expect(git('merge-base', '--is-ancestor', 'main', 'tema')).toBe('')
  })

  it('omite los commits que ya están en la base como cherry-pick', async () => {
    git('checkout', '-q', '-b', 'repetida', 'main')
    commit('r.txt', 'r\n', 'cambio compartido')
    const shared = at('HEAD')
    commit('p.txt', 'p\n', 'propio')
    git('checkout', '-q', 'main')
    git('cherry-pick', shared)
    const commits = await getRebaseCommits(dir, 'refs/heads/main', 'onto', 'refs/heads/repetida')
    expect(commits.map((c) => c.subject)).toEqual(['propio'])
  })
})

describe('merge con referencia completa', () => {
  it('deja el mensaje como lo escribiría git', async () => {
    git('checkout', '-q', '-b', 'para-merge', 'main')
    commit('pm.txt', 'pm\n', 'para merge')
    git('checkout', '-q', '-b', 'receptora', 'main~1')
    commit('rc.txt', 'rc\n', 'propio de receptora')
    await merge(dir, 'refs/heads/para-merge')
    expect(git('log', '-1', '--format=%s')).toBe("Merge branch 'para-merge' into receptora")
  })
})

describe('fetch', () => {
  it('adelanta las ramas locales atrasadas y deja las divergentes, la actual y las de otros worktrees', async () => {
    const base = join(root, 'fetch')
    const remote = join(base, 'remoto.git')
    const mine = join(base, 'mio')
    const other = join(base, 'otro')
    const run = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
    const make = (cwd: string, file: string, message: string): void => {
      writeFileSync(join(cwd, file), `${message}\n`)
      run(cwd, 'add', '-A')
      run(cwd, '-c', 'user.name=Ana', '-c', 'user.email=ana@x.co', 'commit', '-q', '-m', message)
    }
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
    execFileSync('git', ['clone', '-q', remote, other], { stdio: 'ignore' })
    make(other, 'a.txt', 'inicio')
    for (const b of ['main', 'atrasada', 'divergente', 'en-worktree']) run(other, 'push', '-q', 'origin', `HEAD:refs/heads/${b}`)
    execFileSync('git', ['clone', '-q', remote, mine], { stdio: 'ignore' })
    for (const b of ['atrasada', 'divergente', 'en-worktree']) run(mine, 'branch', '-q', '--track', b, `origin/${b}`)
    run(mine, 'worktree', 'add', '-q', join(base, 'wt'), 'en-worktree')
    run(mine, 'checkout', '-q', 'divergente')
    make(mine, 'mio.txt', 'commit propio')
    run(mine, 'checkout', '-q', 'main')
    // En el remoto avanzan todas
    for (const b of ['main', 'atrasada', 'divergente', 'en-worktree']) {
      run(other, 'checkout', '-q', '-B', b, `origin/${b}`)
      make(other, `${b}.txt`, `nuevo en ${b}`)
      run(other, 'push', '-q', 'origin', b)
    }

    const auto = await fetch(mine)
    expect(auto.updated.map((u) => u.branch)).toEqual(['atrasada'])
    expect(auto.diverged).toEqual(['divergente'])
    expect(auto.skipped.map((s) => s.branch)).toEqual(['en-worktree'])
    expect(run(mine, 'rev-parse', 'atrasada')).toBe(run(mine, 'rev-parse', 'origin/atrasada'))
    expect(run(mine, 'rev-parse', 'main')).not.toBe(run(mine, 'rev-parse', 'origin/main'))

    const manual = await fetch(mine, { updateCurrent: true })
    expect(manual.updated).toEqual([expect.objectContaining({ branch: 'main', current: true })])
    expect(run(mine, 'rev-parse', 'HEAD')).toBe(run(mine, 'rev-parse', 'origin/main'))
  })
})
