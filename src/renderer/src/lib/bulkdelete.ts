import type { Ref, Worktree } from '../../../shared/types'
import { remoteTwin } from './refs'

export interface BulkDeletePlan {
  locals: Ref[]
  remotes: Ref[]
  /** Remotas de las locales elegidas, que solo se eliminan si se pide y si la local se eliminó */
  twins: { local: Ref; remote: Ref }[]
  blocked: { ref: Ref; reason: string }[]
}

/** Separa lo que se puede eliminar de lo que un borrado masivo nunca debe tocar. */
export function planBulkDelete(selected: Ref[], refs: Ref[], worktrees: Worktree[]): BulkDeletePlan {
  const plan: BulkDeletePlan = { locals: [], remotes: [], twins: [], blocked: [] }
  const head = refs.find((r) => r.isHead)
  const headUpstream = head && remoteTwin(head, refs)
  const chosen = new Set(selected.map((r) => r.fullName))

  for (const ref of selected) {
    if (ref.type === 'local') {
      if (ref.isHead) plan.blocked.push({ ref, reason: 'Es la rama actual' })
      else if (worktrees.some((t) => t.branch === ref.name)) plan.blocked.push({ ref, reason: 'Está abierta en otro worktree' })
      else {
        plan.locals.push(ref)
        const remote = remoteTwin(ref, refs)
        if (remote && !remote.isDefault && !chosen.has(remote.fullName)) plan.twins.push({ local: ref, remote })
      }
    } else if (ref.type === 'remote') {
      if (ref.isDefault) plan.blocked.push({ ref, reason: 'Es la rama principal del remoto' })
      else if (ref.fullName === headUpstream?.fullName) plan.blocked.push({ ref, reason: 'Es la remota de tu rama actual' })
      else plan.remotes.push(ref)
    }
  }
  return plan
}
