import { describe, expect, it } from 'vitest'
import type { Ref, Worktree } from '../src/shared/types'
import { planBulkDelete } from '../src/renderer/src/lib/bulkdelete'

const local = (name: string, extra: Partial<Ref> = {}): Ref => ({ type: 'local', name, fullName: `refs/heads/${name}`, hash: 'h', ...extra })
const remote = (name: string, extra: Partial<Ref> = {}): Ref => ({ type: 'remote', name, fullName: `refs/remotes/${name}`, hash: 'h', remote: name.split('/')[0], ...extra })

const main = local('main', { isHead: true, upstream: 'origin/main' })
const tema = local('tema', { upstream: 'origin/tema' })
const suelta = local('suelta')
const enWorktree = local('en-worktree')
const originMain = remote('origin/main', { isDefault: true })
const originDev = remote('origin/dev')
const originTema = remote('origin/tema')
const refs = [main, tema, suelta, enWorktree, originMain, originDev, originTema]
const worktrees = [{ path: '/repo', branch: 'main' }, { path: '/otro', branch: 'en-worktree' }] as Worktree[]
const names = (list: { name: string }[]): string[] => list.map((r) => r.name)

describe('planBulkDelete', () => {
  it('nunca incluye la rama actual, ni una abierta en otro worktree, ni la principal del remoto', () => {
    const plan = planBulkDelete(refs, refs, worktrees)
    expect(names(plan.locals)).toEqual(['tema', 'suelta'])
    expect(names(plan.remotes)).toEqual(['origin/dev', 'origin/tema'])
    expect(plan.blocked.map((b) => b.ref.name)).toEqual(['main', 'en-worktree', 'origin/main'])
  })

  it('no toca la remota de la rama actual aunque no sea la principal', () => {
    const dev = local('dev', { isHead: true, upstream: 'origin/dev' })
    const plan = planBulkDelete([originDev], [dev, originDev], [])
    expect(plan.remotes).toEqual([])
    expect(plan.blocked[0].reason).toBe('Es la remota de tu rama actual')
  })

  it('ofrece la remota de una local solo si no estaba ya elegida y no es la principal', () => {
    const plan = planBulkDelete([tema], refs, worktrees)
    expect(plan.twins.map((t) => t.remote.name)).toEqual(['origin/tema'])
    expect(planBulkDelete([tema, originTema], refs, worktrees).twins).toEqual([])
    const conPrincipal = local('otra', { upstream: 'origin/main' })
    expect(planBulkDelete([conPrincipal], [...refs, conPrincipal], worktrees).twins).toEqual([])
  })

  it('ignora las etiquetas', () => {
    const tag: Ref = { type: 'tag', name: 'v1', fullName: 'refs/tags/v1', hash: 'h' }
    const plan = planBulkDelete([tag], [...refs, tag], worktrees)
    expect([...plan.locals, ...plan.remotes, ...plan.blocked]).toEqual([])
  })
})
