import { describe, expect, it } from 'vitest'
import type { Ref } from '../src/shared/types'
import { dropTargetRef, planDrop, type DropContext, type DropTarget } from '../src/renderer/src/lib/drop'
import { labelsByCommit, labelText, labelTrack, type RefLabel } from '../src/renderer/src/lib/refs'

const local = (name: string, hash: string, extra: Partial<Ref> = {}): Ref => ({ type: 'local', name, fullName: `refs/heads/${name}`, hash, ...extra })
const remote = (name: string, hash: string): Ref => ({ type: 'remote', name, fullName: `refs/remotes/${name}`, hash, remote: name.split('/')[0] })

const refs: Ref[] = [
  local('main', 'm1', { upstream: 'origin/main', isHead: true }),
  remote('origin/main', 'm0'),
  local('feature', 'f1', { upstream: 'origin/feature' }),
  remote('origin/feature', 'f1'),
  local('nueva', 'n1'),
  remote('origin/solo-remota', 'r1')
]
const ctx: DropContext = { refs, currentBranch: 'main', prRemote: 'origin', prWord: 'pull request' }
const labels = labelsByCommit(refs, null)
const labelOf = (name: string): RefLabel => [...labels.values()].flat().find((l) => l.name === name)!
const onto = (name: string): DropTarget => ({ kind: 'label', label: labelOf(name) })
const find = (name: string): Ref => refs.find((r) => r.name === name)!
const labelsOf = (items: ReturnType<typeof planDrop>): string[] => items.filter((i) => !i.separator).map((i) => i.label)

describe('etiquetas del gráfico', () => {
  it('une la local y su remota cuando están en el mismo commit', () => {
    const feature = labelOf('feature')
    expect(feature.local?.name).toBe('feature')
    expect(feature.remotes.map((r) => r.name)).toEqual(['origin/feature'])
    // main y origin/main están en commits distintos: dos etiquetas
    expect(labelOf('origin/main').local).toBeUndefined()
  })

  it('une también por la rama que sigue aunque se llame distinto', () => {
    const map = labelsByCommit([local('fix', 'x1', { upstream: 'origin/fix-login' }), remote('origin/fix-login', 'x1')], null)
    const [label] = map.get('x1')!
    expect(label.remotes.map((r) => r.name)).toEqual(['origin/fix-login'])
  })
})

describe('una rama, una etiqueta', () => {
  it('une una rama con el mismo nombre en varios remotos, aunque siga solo a uno', () => {
    const map = labelsByCommit([local('main', 'm1', { upstream: 'origin/main' }), remote('origin/main', 'm1'), remote('fork/main', 'm1')], null)
    expect(map.get('m1')!.length).toBe(1)
    expect(map.get('m1')![0].remotes.map((r) => r.name)).toEqual(['origin/main', 'fork/main'])
  })

  it('une las remotas iguales de una rama que no existe en local y la nombra sin el remoto', () => {
    const map = labelsByCommit([remote('origin/deploy/ios', 'd1'), remote('fork/deploy/ios', 'd1'), remote('origin/otra', 'd1')], null)
    const labels = map.get('d1')!
    expect(labels.map(labelText)).toEqual(['deploy/ios', 'otra'])
    expect(labels[0].remotes.length).toBe(2)
  })

  it('una remota por delante de su local muestra los commits de diferencia', () => {
    const map = labelsByCommit([local('main', 'viejo', { upstream: 'origin/main', behind: 32, isHead: true }), remote('origin/main', 'nuevo'), remote('origin/ajena', 'nuevo')], null)
    const [main, ajena] = map.get('nuevo')!
    expect(main.localTwin?.name).toBe('main')
    expect(labelTrack(main)).toEqual({ ahead: 0, behind: 32 })
    expect(labelTrack(map.get('viejo')![0])).toEqual({ ahead: 0, behind: 32 })
    expect(ajena.localTwin).toBeUndefined()
    expect(labelTrack(ajena)).toEqual({ ahead: 0, behind: 0 })
  })
})

describe('planDrop', () => {
  it('una local sobre su remota atrasada ofrece push', () => {
    const items = planDrop(find('main'), onto('origin/main'), { ahead: 1, behind: 0 }, ctx)
    expect(labelsOf(items)).toEqual(['Push de main a origin/main'])
    expect(items[0].action).toMatchObject({ id: 'push', branch: 'main', remote: 'origin', remoteBranch: 'main', force: false, setUpstream: false })
  })

  it('si divergen, el push es forzado', () => {
    const items = planDrop(find('main'), onto('origin/main'), { ahead: 1, behind: 2 }, ctx)
    expect(items.find((i) => i.action?.id === 'push')?.action).toMatchObject({ force: true })
    expect(labelsOf(items)).toContain('Rebase de main sobre origin/main')
  })

  it('una remota sobre su local trae los cambios', () => {
    const items = planDrop(find('origin/main'), onto('main'), { ahead: 2, behind: 0 }, ctx)
    expect(labelsOf(items)).toEqual(['Fast-forward de main a origin/main', 'Merge de origin/main en main'])
    const diverged = planDrop(find('origin/main'), onto('main'), { ahead: 2, behind: 1 }, ctx)
    expect(labelsOf(diverged)).toEqual(['Merge de origin/main en main', 'Rebase de main sobre origin/main'])
  })

  it('una local sobre otra rama combinada (local y remota) ofrece merge, rebase, push y PR', () => {
    const items = planDrop(find('nueva'), onto('feature'), { ahead: 1, behind: 3 }, ctx)
    expect(labelsOf(items)).toEqual([
      'Merge de nueva en feature',
      'Rebase de nueva sobre feature',
      'Rebase interactivo de nueva sobre feature…',
      'Push forzado de nueva a origin/feature…',
      'Crear pull request de nueva a feature…'
    ])
    // nueva no está subida: el PR la sube primero
    expect(items.at(-1)?.action).toMatchObject({ id: 'pr', branch: 'nueva', head: null, base: 'feature' })
  })

  it('el merge y el fast-forward en una rama que no es la actual lo indican', () => {
    const items = planDrop(find('main'), onto('feature'), { ahead: 2, behind: 0 }, ctx)
    expect(items[0].action).toMatchObject({ id: 'ff', branch: 'feature', current: false })
    expect(items[1].action).toMatchObject({ id: 'merge', into: 'feature', current: false })
  })

  it('avisa cuando no hay nada que hacer', () => {
    expect(labelsOf(planDrop(find('feature'), onto('main'), { ahead: 0, behind: 0 }, ctx))).toEqual(['feature y main están en el mismo commit'])
    expect(planDrop(find('feature'), onto('feature'), { ahead: 0, behind: 0 }, ctx)).toEqual([])
  })

  it('sobre un remoto del panel publica la rama', () => {
    const target: DropTarget = { kind: 'remote', remote: 'origin' }
    expect(dropTargetRef(find('nueva'), target, refs)).toBeNull()
    const items = planDrop(find('nueva'), target, null, ctx)
    expect(items[0]).toMatchObject({ label: 'Push de nueva a origin (crea origin/nueva)', action: { setUpstream: true } })
    expect(dropTargetRef(find('main'), target, refs)?.name).toBe('origin/main')
  })

  it('una remota sobre otra remota solo puede abrir un PR', () => {
    const items = planDrop(find('origin/solo-remota'), onto('origin/main'), { ahead: 1, behind: 1 }, ctx)
    expect(labelsOf(items)).toEqual(['Crear pull request de solo-remota a main…'])
    const sinProveedor = planDrop(find('origin/solo-remota'), onto('origin/main'), { ahead: 1, behind: 1 }, { ...ctx, prRemote: null })
    expect(labelsOf(sinProveedor)[0]).toMatch(/suéltala sobre una rama local/)
  })
})
