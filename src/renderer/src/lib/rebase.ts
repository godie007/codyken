import type { RebaseAction } from '../../../shared/types'

/** Validación igual a la del proceso principal, para avisar antes de empezar el rebase. */
export function rebaseProblem(rows: { action: RebaseAction; draft: string }[]): string | null {
  const first = rows.find((r) => r.action !== 'drop')
  if (first && (first.action === 'squash' || first.action === 'fixup')) return 'El primer commit que se conserva no puede combinarse con uno anterior.'
  if (rows.some((r) => r.action === 'reword' && !r.draft.trim())) return 'Escribe el mensaje nuevo de los commits que vas a reescribir.'
  return null
}
