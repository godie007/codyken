import type { Divergence, Ref } from '../../../shared/types'
import { remoteBranchName, remoteTwin, type RefLabel } from './refs'

/** Tipo de dato del arrastre: la referencia completa de la rama (refs/heads/… o refs/remotes/…) */
export const REF_MIME = 'application/x-codyken-ref'

/** Dónde se suelta una rama: sobre otra etiqueta de rama (gráfico o panel) o sobre un remoto del panel */
export type DropTarget = { kind: 'label'; label: RefLabel } | { kind: 'remote'; remote: string }

/** Las referencias de git van completas (refs/heads/…, refs/remotes/…); los nombres cortos son para mostrar. */
export type DropAction =
  | { id: 'ff'; branch: string; to: string; toName: string; current: boolean }
  | { id: 'merge'; source: string; sourceName: string; into: string; current: boolean }
  | { id: 'rebase'; branch: string; onto: string; ontoName: string; current: boolean }
  | { id: 'rebase-i'; branch: string; onto: string; ontoName: string }
  | { id: 'push'; branch: string; remote: string; remoteBranch: string; force: boolean; setUpstream: boolean }
  | { id: 'pr'; branch: string; head: string | null; base: string }

export interface DropItem {
  label: string
  /** Sin acción = línea informativa deshabilitada */
  action?: DropAction
  separator?: boolean
}

export interface DropContext {
  refs: Ref[]
  currentBranch: string | null
  /** Remoto del proveedor de PRs (GitHub/GitLab), si lo hay */
  prRemote: string | null
  prWord: string
}

/** Referencias de la etiqueta destino, sin la propia rama arrastrada (soltar una rama sobre sí misma no hace nada) */
function targetSides(source: Ref, target: DropTarget, refs: Ref[]): { local?: Ref; remotes: Ref[] } {
  if (target.kind === 'remote') {
    const existing = refs.find((r) => r.type === 'remote' && r.remote === target.remote && remoteBranchName(r) === (source.type === 'local' ? source.name : remoteBranchName(source)))
    return { remotes: existing ? [existing] : [] }
  }
  const { label } = target
  return {
    local: label.local && label.local.fullName !== source.fullName ? label.local : undefined,
    remotes: label.remotes.filter((r) => r.fullName !== source.fullName)
  }
}

/** Referencia con la que se compara la rama arrastrada (todas las del destino están en el mismo commit). */
export function dropTargetRef(source: Ref, target: DropTarget, refs: Ref[]): Ref | null {
  const sides = targetSides(source, target, refs)
  return sides.local ?? sides.remotes[0] ?? null
}

/**
 * Opciones del menú al soltar `source` sobre `target`, como en un cliente Git visual:
 * - sobre una rama local: fast-forward, merge de la arrastrada en ella y rebase de la arrastrada encima;
 * - una local sobre su remota (u otra remota): push, o push forzado si divergen;
 * - una remota sobre una local: traer sus cambios (fast-forward, merge o rebase de la local);
 * - sobre un remoto del panel: publicar la rama allí;
 * - y, si hay GitHub/GitLab, crear el pull request de una a otra.
 * `div` compara la arrastrada con el destino: ahead = commits que solo tiene la arrastrada.
 */
export function planDrop(source: Ref, target: DropTarget, div: Divergence | null, ctx: DropContext): DropItem[] {
  if (source.type === 'tag') return []
  if (target.kind === 'label' && [target.label.local, ...target.label.remotes].some((r) => r?.fullName === source.fullName)) return []
  const { refs, currentBranch } = ctx
  const sides = targetSides(source, target, refs)
  const S = source.name
  const ahead = div?.ahead ?? 0
  const behind = div?.behind ?? 0
  const groups: DropItem[][] = []

  if (target.kind === 'remote') {
    if (source.type !== 'local') return [{ label: 'Arrastra una rama local para subirla a este remoto' }]
    const existing = sides.remotes[0]
    if (!existing) {
      return [{ label: `Push de ${S} a ${target.remote} (crea ${target.remote}/${S})`, action: { id: 'push', branch: S, remote: target.remote, remoteBranch: S, force: false, setUpstream: !source.upstream } }]
    }
    groups.push(pushItems(source, existing, ahead, behind))
  }

  if (target.kind === 'label') {
    const local = sides.local
    if (local) {
      const T = local.name
      const items: DropItem[] = []
      if (ahead === 0) items.push({ label: behind === 0 ? `${S} y ${T} están en el mismo commit` : `${T} ya contiene todos los commits de ${S}` })
      else {
        const current = local.name === currentBranch
        if (behind === 0) items.push({ label: `Fast-forward de ${T} a ${S}`, action: { id: 'ff', branch: T, to: source.fullName, toName: S, current } })
        items.push({ label: `Merge de ${S} en ${T}`, action: { id: 'merge', source: source.fullName, sourceName: S, into: T, current } })
        if (behind > 0 && source.type === 'local') {
          items.push({ label: `Rebase de ${S} sobre ${T}`, action: { id: 'rebase', branch: S, onto: local.fullName, ontoName: T, current: S === currentBranch } })
          items.push({ label: `Rebase interactivo de ${S} sobre ${T}…`, action: { id: 'rebase-i', branch: S, onto: local.fullName, ontoName: T } })
        }
        if (behind > 0 && source.type === 'remote') {
          items.push({ label: `Rebase de ${T} sobre ${S}`, action: { id: 'rebase', branch: T, onto: source.fullName, ontoName: S, current } })
        }
      }
      groups.push(items)
    }

    if (source.type === 'local') {
      for (const remote of sides.remotes) {
        const items = pushItems(source, remote, ahead, behind)
        // Sobre una rama que solo está en el remoto también se puede reconstruir la tuya encima de ella
        if (!local && behind > 0 && ahead > 0) {
          items.push({ label: `Rebase de ${S} sobre ${remote.name}`, action: { id: 'rebase', branch: S, onto: remote.fullName, ontoName: remote.name, current: S === currentBranch } })
          items.push({ label: `Rebase interactivo de ${S} sobre ${remote.name}…`, action: { id: 'rebase-i', branch: S, onto: remote.fullName, ontoName: remote.name } })
        }
        // Si la local de destino ya informó que están en el mismo commit, no se repite el aviso
        groups.push(local && ahead === 0 ? items.filter((i) => i.action) : items)
      }
    }

    const pr = prItem(source, sides, ahead, ctx)
    if (pr) groups.push([pr])

    if (!local && source.type === 'remote' && !groups.some((g) => g.length)) {
      groups.push([{ label: `Para traer ${S} a ${sides.remotes[0]?.name ?? 'esa rama'}, suéltala sobre una rama local` }])
    }
  }

  const out: DropItem[] = []
  for (const group of groups.filter((g) => g.length)) {
    if (out.length) out.push({ label: '', separator: true })
    out.push(...group)
  }
  return out
}

function pushItems(source: Ref, remote: Ref, ahead: number, behind: number): DropItem[] {
  const branch = source.name
  const remoteBranch = remoteBranchName(remote)
  const base = { id: 'push' as const, branch, remote: remote.remote!, remoteBranch }
  if (ahead === 0) return [{ label: behind === 0 ? `${remote.name} ya está al día con ${branch}` : `${remote.name} ya tiene todos los commits de ${branch}` }]
  // Se sigue la remota solo si la rama no sigue ya otra
  if (behind === 0) return [{ label: `Push de ${branch} a ${remote.name}`, action: { ...base, force: false, setUpstream: !source.upstream } }]
  return [{ label: `Push forzado de ${branch} a ${remote.name}…`, action: { ...base, force: true, setUpstream: false } }]
}

/** Pull request de la rama arrastrada (subida o por subir al remoto del proveedor) hacia la rama destino en ese remoto */
function prItem(source: Ref, sides: { local?: Ref; remotes: Ref[] }, ahead: number, ctx: DropContext): DropItem | null {
  const remote = ctx.prRemote
  if (!remote || ahead === 0) return null
  const baseRef = sides.remotes.find((r) => r.remote === remote) ?? (sides.local ? remoteTwin(sides.local, ctx.refs, remote) : undefined)
  if (!baseRef || baseRef.remote !== remote) return null
  const base = remoteBranchName(baseRef)
  let branch: string
  let head: string | null
  if (source.type === 'local') {
    const twin = remoteTwin(source, ctx.refs, remote)
    branch = source.name
    head = twin && twin.remote === remote ? remoteBranchName(twin) : null
  } else {
    if (source.remote !== remote) return null
    branch = remoteBranchName(source)
    head = branch
  }
  if (head === base || (!head && branch === base)) return null
  return { label: `Crear ${ctx.prWord} de ${head ?? branch} a ${base}…`, action: { id: 'pr', branch, head, base } }
}
