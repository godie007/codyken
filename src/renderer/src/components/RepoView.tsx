import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Commit, DiffSource, FileChange, GraphFilter, MenuItemSpec, PullMode, Ref, RepoState, ResetMode, Settings, StashEntry } from '../../../shared/types'
import { api, mod } from '../api'
import { homeRelative, relativeTime, repoName, shortHash } from '../lib/format'
import { computeGraph, WIP_HASH } from '../lib/graph'
import { labelsByCommit, type RefLabel } from '../lib/refs'
import { useRepoData } from '../useRepoData'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { CommitPanel, type CommitDraft, type CommitPanelActions, type Selection } from './CommitPanel'
import { DiffView } from './DiffView'
import { BlameView, FileHistory } from './FileTools'
import { GraphView } from './GraphView'
import { Icon } from './Icons'
import { LeftPanel } from './LeftPanel'
import { Toolbar } from './Toolbar'
import { Resizer, usePrompt, useToast } from './ui'

const drafts = new Map<string, CommitDraft>()
const EMPTY_DRAFT: CommitDraft = { summary: '', body: '', amend: false }
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const NO_FILTER: GraphFilter = { hidden: [], solo: [] }
const UNDO_LIMIT = 20

/** Una acción que se puede deshacer, válida solo mientras HEAD siga donde la dejó. */
interface UndoEntry {
  label: string
  head: string | null
  branch: string | null
  /** El deshacer usa reset --hard: exige no tener cambios sin confirmar */
  hard: boolean
  undo: () => Promise<unknown>
}

type FileTool = { kind: 'history' | 'blame'; path: string; rev: string | null }

export interface RepoViewProps {
  repo: string
  settings: Settings
  onSettings: (patch: Partial<Settings>) => void
  onOpenRepo: (path?: string) => void
  onNewTab: () => void
}

export function RepoView({ repo, settings, onSettings, onOpenRepo, onNewTab }: RepoViewProps) {
  const filter = settings.graphFilters[repo] ?? NO_FILTER
  const { data, refreshAll, refreshStatus, loadMore } = useRepoData(repo, filter)
  const { toast } = useToast()
  const prompt = usePrompt()
  const [selection, setSelection] = useState<Selection>(null)
  const [diff, setDiff] = useState<DiffSource | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef<string | null>(null)
  const [palette, setPalette] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<{ hash: string; nonce: number } | null>(null)
  const [searchFocus, setSearchFocus] = useState(0)
  const [filterFocus, setFilterFocus] = useState(0)
  const [summaryFocus, setSummaryFocus] = useState(0)
  const [draft, setDraftState] = useState<CommitDraft>(drafts.get(repo) ?? EMPTY_DRAFT)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [fileTool, setFileTool] = useState<FileTool | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  const { commits, refs, state, status, stashes } = data
  const head = state?.head ?? null
  const currentBranch = state?.branch ?? null
  const hasWip = status.staged.length + status.unstaged.length + status.conflicted.length > 0
  const hasTrackedChanges = status.staged.length + status.conflicted.length + status.unstaged.filter((f) => f.status !== '?').length > 0
  const filterActive = filter.hidden.length > 0 || filter.solo.length > 0
  const headRef = refs.find((r) => r.type === 'local' && r.isHead)
  const labels = useMemo(() => labelsByCommit(refs, state?.detached ? head : null), [refs, state?.detached, head])
  // Los stashes se intercalan en el gráfico justo encima de su commit base (o donde les toque por fecha)
  const graphCommits = useMemo(() => {
    if (!stashes.length) return commits
    const position = new Map(commits.map((c, i) => [c.hash, i]))
    const inserts = new Map<number, Commit[]>()
    for (const s of stashes) {
      const baseIndex = position.get(s.base)
      if (baseIndex === undefined) continue
      const byDate = commits.findIndex((c) => c.date <= s.date)
      const at = byDate === -1 ? baseIndex : Math.min(byDate, baseIndex)
      const list = inserts.get(at) ?? []
      list.push({ hash: s.hash, parents: [s.base], author: s.author, email: s.email, date: s.date, subject: s.message || `stash@{${s.index}}`, stash: s.index })
      inserts.set(at, list)
    }
    if (!inserts.size) return commits
    return commits.flatMap((c, i) => [...(inserts.get(i)?.sort((a, b) => b.date - a.date) ?? []), c])
  }, [commits, stashes])
  const graph = useMemo(
    () => computeGraph(hasWip ? [{ hash: WIP_HASH, parents: head ? [head] : [] }, ...graphCommits] : graphCommits, hasWip ? WIP_HASH : head),
    [graphCommits, hasWip, head]
  )
  const selectedHash = selection?.kind === 'wip' ? WIP_HASH : selection ? selection.hash : null

  const setDraft = useCallback(
    (next: CommitDraft) => {
      drafts.set(repo, next)
      setDraftState(next)
    },
    [repo]
  )

  // Selección inicial y salida del nodo WIP cuando ya no hay cambios
  useEffect(() => {
    if (!data.loaded) return
    if (selection === null || (selection.kind === 'wip' && !hasWip)) {
      if (hasWip) setSelection({ kind: 'wip' })
      else if (head) setSelection({ kind: 'commit', hash: head })
    }
  }, [data.loaded, hasWip, head])

  // Si el commit seleccionado desapareció (deshacer, reset, rebase), volver al WIP o a HEAD
  useEffect(() => {
    if (!data.loaded || selection?.kind !== 'commit' || commits.some((c) => c.hash === selection.hash)) return
    setSelection(hasWip ? { kind: 'wip' } : head ? { kind: 'commit', hash: head } : null)
  }, [commits])

  // Si el archivo del diff cambió de lista (se preparó, se quitó o se resolvió), seguirlo
  useEffect(() => {
    if (!diff || diff.kind === 'commit' || !data.loaded) return
    const find = (list: FileChange[]): FileChange | undefined => list.find((f) => f.path === diff.path)
    const unstaged = find(status.unstaged)
    const staged = find(status.staged)
    const asStaged = staged ? ({ kind: 'staged', path: staged.path, oldPath: staged.oldPath, status: staged.status } as const) : null
    const asUnstaged = unstaged ? ({ kind: 'unstaged', path: unstaged.path, status: unstaged.status } as const) : null
    if (diff.kind === 'unstaged' && !unstaged) setDiff(asStaged)
    else if (diff.kind === 'staged' && !staged) setDiff(asUnstaged)
    else if (diff.kind === 'conflict' && !find(status.conflicted)) setDiff(asStaged ?? asUnstaged)
  }, [status])

  // ── Ejecución de comandos ────────────────────────────────────────────────

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
      if (busyRef.current) {
        toast('info', `Espera a que termine: ${busyRef.current}`)
        return false
      }
      busyRef.current = label
      setBusy(label)
      try {
        await fn()
        if (success) toast('success', success)
        return true
      } catch (e) {
        toast('error', `${label}: no se pudo completar`, errorText(e))
        return false
      } finally {
        busyRef.current = null
        setBusy(null)
        void refreshAll()
      }
    },
    [toast, refreshAll]
  )

  const quick = useCallback(
    async (label: string, fn: () => Promise<unknown>): Promise<void> => {
      try {
        await fn()
      } catch (e) {
        toast('error', label, errorText(e))
      } finally {
        void refreshStatus()
      }
    },
    [toast, refreshStatus]
  )

  const confirm = (message: string, confirmLabel: string, detail?: string, destructive = false): Promise<boolean> =>
    api.confirm({ message, confirmLabel, detail, destructive })

  // ── Deshacer ─────────────────────────────────────────────────────────────

  const pushUndo = (entry: UndoEntry): void => setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), entry])

  const remember = async (label: string, undo: () => Promise<unknown>, hard = false): Promise<void> => {
    const after = await api.getRepoState(repo).catch(() => null)
    if (after && !after.operation) pushUndo({ label, head: after.head, branch: after.branch, hard, undo })
  }

  /** Ejecuta una operación que mueve HEAD y registra cómo volver al estado anterior. */
  const runUndoable = async (
    label: string,
    fn: () => Promise<unknown>,
    success: string,
    makeUndo: (before: RepoState) => { undo: () => Promise<unknown>; hard?: boolean } | null
  ): Promise<boolean> => {
    const before = await api.getRepoState(repo).catch(() => null)
    const ok = await run(label, fn, success)
    if (!ok || !before) return ok
    const after = await api.getRepoState(repo).catch(() => null)
    if (!after || after.operation || (after.head === before.head && after.branch === before.branch)) return ok
    const plan = makeUndo(before)
    if (plan) pushUndo({ label, head: after.head, branch: after.branch, hard: !!plan.hard, undo: plan.undo })
    return ok
  }

  const backTo = (before: RepoState) => () =>
    before.branch ? api.checkout(repo, { kind: 'local', name: before.branch }) : api.checkout(repo, { kind: 'commit', hash: before.head! })

  const resetTo = (before: RepoState, mode: ResetMode = 'hard') =>
    before.head ? { undo: () => api.reset(repo, before.head!, mode), hard: mode === 'hard' } : null

  const undoLast = async (): Promise<void> => {
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return toast('info', 'No hay nada que deshacer')
    if (busyRef.current) return toast('info', `Espera a que termine: ${busyRef.current}`)
    const now = await api.getRepoState(repo)
    if (now.head !== entry.head || now.branch !== entry.branch || now.operation) {
      setUndoStack([])
      return toast('info', 'Ya no se puede deshacer', 'El repositorio cambió desde la última acción (quizá desde la terminal).')
    }
    if (entry.hard) {
      if (hasTrackedChanges) return toast('error', `No se puede deshacer "${entry.label}"`, 'Tienes cambios sin confirmar. Haz commit o stash primero.')
      if (!(await confirm(`¿Deshacer "${entry.label}"?`, 'Deshacer', 'Los commits creados por esa acción dejarán de estar en la rama.'))) return
    }
    const ok = await run('Deshacer', entry.undo, `Deshecho: ${entry.label}`)
    if (ok) setUndoStack((stack) => stack.slice(0, -1))
  }

  // ── Filtro del gráfico ───────────────────────────────────────────────────

  const setFilter = (next: GraphFilter): void => {
    const graphFilters = { ...settings.graphFilters }
    if (next.hidden.length || next.solo.length) graphFilters[repo] = next
    else delete graphFilters[repo]
    onSettings({ graphFilters })
  }

  const isRefHidden = (ref: Ref): boolean =>
    filter.solo.length ? !filter.solo.includes(ref.fullName) && !ref.isHead : filter.hidden.includes(ref.fullName)

  // Una rama local se oculta junto con sus remotas (upstream o mismo nombre): si no, seguirían mostrando sus commits
  const withUpstream = (r: Ref): string[] => {
    if (r.type !== 'local') return [r.fullName]
    const twins = refs.filter((x) => x.type === 'remote' && (x.name === r.upstream || x.name.slice(x.remote!.length + 1) === r.name))
    return [r.fullName, ...twins.map((x) => x.fullName)]
  }

  const toggleHidden = (list: Ref[]): void => {
    const targets = [...new Set(list.filter((r) => !r.isHead).flatMap(withUpstream))]
    if (!targets.length) return
    const allHidden = list.filter((r) => !r.isHead).every(isRefHidden)
    if (filter.solo.length) {
      const solo = allHidden ? [...new Set([...filter.solo, ...targets])] : filter.solo.filter((n) => !targets.includes(n))
      setFilter({ hidden: [], solo })
    } else {
      const hidden = allHidden ? filter.hidden.filter((n) => !targets.includes(n)) : [...new Set([...filter.hidden, ...targets])]
      setFilter({ hidden, solo: [] })
    }
  }

  // ── Remotos ──────────────────────────────────────────────────────────────

  const fetchAll = (silent = false): void => {
    if (silent) {
      api.fetch(repo).then(
        () => setLastFetch(Date.now()),
        () => {}
      )
      return
    }
    void run('Fetch', async () => {
      await api.fetch(repo)
      setLastFetch(Date.now())
    }, 'Fetch completado')
  }

  const pull = (mode: PullMode): void => {
    void runUndoable('Pull', () => api.pull(repo, mode), 'Pull completado', (before) => resetTo(before))
  }

  const push = async (): Promise<void> => {
    if (busyRef.current) return
    busyRef.current = 'Push'
    setBusy('Push')
    let rejected = ''
    try {
      await api.push(repo, false)
      toast('success', 'Push completado')
    } catch (e) {
      const message = errorText(e)
      if (/rejected|non-fast-forward|fetch first/i.test(message)) rejected = message
      else toast('error', 'Push: no se pudo completar', message)
    } finally {
      busyRef.current = null
      setBusy(null)
      void refreshAll()
    }
    if (rejected) {
      const force = await confirm(
        'El remoto tiene commits que tú no tienes',
        'Forzar push',
        'Lo normal es hacer pull primero. Forzar usa --force-with-lease: sobrescribe la rama remota solo si nadie la cambió desde tu último fetch.',
        true
      )
      if (force) await run('Push forzado', () => api.push(repo, true), 'Push forzado completado')
    }
  }

  // ── Ramas, etiquetas y commits ───────────────────────────────────────────

  const newBranch = async (start?: string): Promise<void> => {
    const result = await prompt({
      title: 'Nueva rama',
      label: start ? `Desde el commit ${shortHash(start)}` : `Desde ${currentBranch ?? 'HEAD'}`,
      placeholder: 'feature/mi-cambio',
      confirmLabel: 'Crear rama',
      checkboxLabel: 'Cambiar a la nueva rama',
      checkboxDefault: true,
      validate: (v) => (/\s/.test(v) ? 'El nombre no puede tener espacios' : refs.some((r) => r.type === 'local' && r.name === v) ? 'Ya existe una rama con ese nombre' : null)
    })
    if (!result) return
    const before = await api.getRepoState(repo).catch(() => null)
    const ok = await run('Crear rama', () => api.createBranch(repo, result.value, start ?? 'HEAD', result.checked), `Rama ${result.value} creada`)
    if (ok && before)
      await remember(`Crear rama ${result.value}`, async () => {
        if (result.checked && before.head) await backTo(before)()
        await api.deleteBranch(repo, result.value, true)
      })
  }

  const checkoutRef = async (ref: Ref): Promise<void> => {
    if (ref.type === 'local') {
      if (!ref.isHead) await runUndoable(`Checkout de ${ref.name}`, () => api.checkout(repo, { kind: 'local', name: ref.name }), `Ahora estás en ${ref.name}`, (b) => b.head ? { undo: backTo(b) } : null)
    } else if (ref.type === 'remote') {
      const local = ref.name.slice(ref.name.indexOf('/') + 1)
      await runUndoable(`Checkout de ${local}`, () => api.checkout(repo, { kind: 'remote', name: ref.name }), `Ahora estás en ${local}`, (b) => b.head ? { undo: backTo(b) } : null)
    } else await checkoutCommit(ref.hash, `la etiqueta ${ref.name}`)
  }

  const checkoutCommit = async (hash: string, what = `el commit ${shortHash(hash)}`): Promise<void> => {
    const ok = await confirm(`¿Hacer checkout de ${what}?`, 'Checkout', 'Quedarás en "HEAD desacoplado": los commits que hagas no pertenecerán a ninguna rama hasta que crees una.')
    if (ok) await runUndoable(`Checkout de ${shortHash(hash)}`, () => api.checkout(repo, { kind: 'commit', hash }), `HEAD en ${shortHash(hash)}`, (b) => b.head ? { undo: backTo(b) } : null)
  }

  const activateLabel = (label: RefLabel): void => {
    const ref = label.local ?? label.remotes[0] ?? label.tag
    if (ref) void checkoutRef(ref)
  }

  const activateCommit = (commit: Commit): void => {
    if (commit.stash !== undefined) return
    const commitLabels = labels.get(commit.hash) ?? []
    const target = commitLabels.find((l) => l.local && !l.isHead) ?? commitLabels.find((l) => !l.local && l.remotes.length)
    if (commitLabels.some((l) => l.isHead)) return
    if (target) activateLabel(target)
    else void checkoutCommit(commit.hash)
  }

  const merge = async (ref: string): Promise<void> => {
    if (!currentBranch) return toast('error', 'No estás en ninguna rama')
    await runUndoable(`Merge de ${ref}`, () => api.merge(repo, ref), `Merge de ${ref} en ${currentBranch} completado`, (b) => resetTo(b))
  }

  const rebase = async (onto: string): Promise<void> => {
    if (!currentBranch) return toast('error', 'No estás en ninguna rama')
    const ok = await confirm(`¿Hacer rebase de ${currentBranch} sobre ${onto}?`, 'Rebase', 'Reescribe los commits de tu rama. Si ya la compartiste, tendrás que forzar el push.')
    if (ok) await runUndoable(`Rebase sobre ${onto}`, () => api.rebase(repo, onto), `Rebase de ${currentBranch} sobre ${onto} completado`, (b) => resetTo(b))
  }

  const dropLabel = async (source: string, target: RefLabel): Promise<void> => {
    const targetName = target.local!.name
    const id = await api.contextMenu([
      { id: 'merge', label: `Merge de ${source} en ${targetName}` },
      { id: 'rebase', label: `Rebase de ${targetName} sobre ${source}` }
    ])
    if (!id) return
    const needsCheckout = !target.local!.isHead
    const targetHash = target.local!.hash
    const undoDrop = (before: RepoState) => ({
      hard: true,
      undo: async () => {
        await api.reset(repo, targetHash, 'hard')
        if (needsCheckout && before.head) await backTo(before)()
      }
    })
    if (id === 'merge') {
      await runUndoable(`Merge de ${source} en ${targetName}`, async () => {
        if (needsCheckout) await api.checkout(repo, { kind: 'local', name: targetName })
        await api.merge(repo, source)
      }, `Merge de ${source} en ${targetName} completado`, undoDrop)
    } else {
      const ok = await confirm(`¿Hacer rebase de ${targetName} sobre ${source}?`, 'Rebase', 'Reescribe los commits de la rama.')
      if (!ok) return
      await runUndoable(`Rebase de ${targetName} sobre ${source}`, async () => {
        if (needsCheckout) await api.checkout(repo, { kind: 'local', name: targetName })
        await api.rebase(repo, source)
      }, `Rebase de ${targetName} sobre ${source} completado`, undoDrop)
    }
  }

  const deleteLocalBranch = async (ref: Ref): Promise<void> => {
    if (ref.isHead) return toast('error', 'No puedes eliminar la rama en la que estás')
    if (!(await confirm(`¿Eliminar la rama ${ref.name}?`, 'Eliminar', undefined, true))) return
    const restore = () => api.createBranch(repo, ref.name, ref.hash, false)
    try {
      await api.deleteBranch(repo, ref.name, false)
      toast('success', `Rama ${ref.name} eliminada`)
      await remember(`Eliminar rama ${ref.name}`, restore)
    } catch (e) {
      if (/not fully merged/i.test(errorText(e))) {
        const force = await confirm(`${ref.name} tiene commits que no están en ninguna otra rama`, 'Eliminar de todos modos', 'Puedes recuperarla con Deshacer mientras no cambies nada más.', true)
        if (force && (await run('Eliminar rama', () => api.deleteBranch(repo, ref.name, true), `Rama ${ref.name} eliminada`))) await remember(`Eliminar rama ${ref.name}`, restore)
      } else toast('error', 'No se pudo eliminar la rama', errorText(e))
    } finally {
      void refreshAll()
    }
  }

  const renameBranch = async (ref: Ref): Promise<void> => {
    const result = await prompt({ title: 'Renombrar rama', initial: ref.name, confirmLabel: 'Renombrar', validate: (v) => (/\s/.test(v) ? 'El nombre no puede tener espacios' : null) })
    if (result && result.value !== ref.name && (await run('Renombrar rama', () => api.renameBranch(repo, ref.name, result.value), `Rama renombrada a ${result.value}`))) {
      await remember(`Renombrar ${ref.name}`, () => api.renameBranch(repo, result.value, ref.name))
    }
  }

  const createTag = async (hash: string): Promise<void> => {
    const result = await prompt({
      title: 'Nueva etiqueta',
      label: `En el commit ${shortHash(hash)}`,
      placeholder: 'v1.0.0',
      confirmLabel: 'Crear etiqueta',
      secondaryLabel: 'Mensaje (opcional; crea una etiqueta anotada)',
      validate: (v) => (/\s/.test(v) ? 'El nombre no puede tener espacios' : refs.some((r) => r.type === 'tag' && r.name === v) ? 'Ya existe esa etiqueta' : null)
    })
    if (result && (await run('Crear etiqueta', () => api.createTag(repo, result.value, hash, result.secondary), `Etiqueta ${result.value} creada`))) {
      await remember(`Crear etiqueta ${result.value}`, () => api.deleteTag(repo, result.value))
    }
  }

  const reset = async (hash: string, mode: ResetMode): Promise<void> => {
    const target = currentBranch ?? 'HEAD'
    const detail = {
      soft: 'Los cambios de los commits deshechos quedan preparados.',
      mixed: 'Los cambios de los commits deshechos quedan sin preparar.',
      hard: 'Se pierden los commits deshechos y TODOS los cambios sin confirmar.'
    }[mode]
    const ok = await confirm(`¿Reset ${mode} de ${target} a ${shortHash(hash)}?`, 'Reset', detail, mode === 'hard')
    if (ok) await runUndoable(`Reset ${mode} a ${shortHash(hash)}`, () => api.reset(repo, hash, mode), `${target} ahora apunta a ${shortHash(hash)}`, (b) => resetTo(b, mode))
  }

  const copy = (text: string, what: string): void => {
    void api.copyText(text).then(() => toast('success', `${what} copiado`))
  }

  // ── Stash ────────────────────────────────────────────────────────────────

  const stash = async (): Promise<void> => {
    if (!hasWip) return toast('info', 'No hay cambios para guardar en el stash')
    const result = await prompt({ title: 'Guardar cambios en el stash', placeholder: 'Descripción (opcional)', confirmLabel: 'Guardar', optional: true })
    if (result) await run('Stash', () => api.stashPush(repo, result.value), 'Cambios guardados en el stash')
  }

  const stashApply = async (entry: StashEntry, pop: boolean): Promise<void> => {
    const ok = await run(pop ? 'Pop' : 'Aplicar stash', () => api.stashApply(repo, entry.index, pop), pop ? 'Stash aplicado y eliminado' : 'Stash aplicado')
    if (ok) setSelection({ kind: 'wip' })
  }

  const stashDrop = async (entry: StashEntry): Promise<void> => {
    if (await confirm(`¿Eliminar el stash "${entry.message}"?`, 'Eliminar', 'No se puede deshacer.', true)) {
      await run('Eliminar stash', () => api.stashDrop(repo, entry.index), 'Stash eliminado')
      setSelection(hasWip ? { kind: 'wip' } : head ? { kind: 'commit', hash: head } : null)
    }
  }

  // ── Staging y commit ─────────────────────────────────────────────────────

  const paths = (files: FileChange[]): string[] => files.flatMap((f) => (f.oldPath ? [f.oldPath, f.path] : [f.path]))

  const discardFiles = async (files: FileChange[]): Promise<void> => {
    const what = files.length === 1 ? files[0].path : `${files.length} archivos`
    if (await confirm(`¿Descartar los cambios de ${what}?`, 'Descartar', 'Los cambios sin preparar se pierden y no se pueden recuperar.', true)) {
      await quick('No se pudieron descartar los cambios', () => api.discard(repo, files))
    }
  }

  const discardAll = async (): Promise<void> => {
    if (await confirm('¿Descartar TODOS los cambios?', 'Descartar todo', 'Se pierden los cambios preparados, los sin preparar y los archivos nuevos. No se puede deshacer.', true)) {
      await run('Descartar todo', () => api.discardAll(repo), 'Cambios descartados')
    }
  }

  const commitMessage = (): string => (draft.body.trim() ? `${draft.summary.trim()}\n\n${draft.body.trim()}` : draft.summary.trim())

  const commit = async (): Promise<void> => {
    if (!draft.summary.trim()) {
      setSummaryFocus((n) => n + 1)
      return
    }
    const saved = draft
    const ok = await runUndoable(draft.amend ? 'Amend' : `Commit "${draft.summary.trim()}"`, () => api.commit(repo, commitMessage(), draft.amend), draft.amend ? 'Commit modificado' : 'Commit creado', (b) =>
      b.head ? { undo: async () => (await api.reset(repo, b.head!, 'soft'), setDraft({ ...saved, amend: false })) } : null
    )
    if (ok) setDraft(EMPTY_DRAFT)
  }

  const stageAllAndCommit = async (): Promise<void> => {
    if (!draft.summary.trim()) {
      setSummaryFocus((n) => n + 1)
      return
    }
    const saved = draft
    const ok = await runUndoable(`Commit "${draft.summary.trim()}"`, async () => {
      await api.stageAll(repo)
      await api.commit(repo, commitMessage(), draft.amend)
    }, 'Commit creado', (b) => (b.head ? { undo: async () => (await api.reset(repo, b.head!, 'soft'), setDraft({ ...saved, amend: false })) } : null))
    if (ok) setDraft(EMPTY_DRAFT)
  }

  const toggleAmend = async (amend: boolean): Promise<void> => {
    if (amend && !draft.summary.trim() && !draft.body.trim()) {
      const message = await api.getLastCommitMessage(repo)
      const [summary, ...rest] = message.split('\n')
      setDraft({ summary, body: rest.join('\n').trim(), amend: true })
    } else setDraft({ ...draft, amend })
  }

  const abortOperation = async (): Promise<void> => {
    const op = state?.operation
    if (op && (await confirm(`¿Abortar el ${op}?`, 'Abortar', 'El repositorio vuelve al estado anterior a la operación.'))) {
      await run('Abortar', () => api.abortOperation(repo, op), `${op} abortado`)
    }
  }

  const continueOperation = async (): Promise<void> => {
    const op = state?.operation
    if (op) await run('Continuar', () => api.continueOperation(repo, op), `${op} completado`)
  }

  // ── Menús contextuales ───────────────────────────────────────────────────

  const commitMenu = async (commit: Commit): Promise<void> => {
    const stashEntry = commit.stash !== undefined ? stashes.find((s) => s.index === commit.stash) : undefined
    if (stashEntry) return stashMenu(stashEntry)
    const items: MenuItemSpec[] = [
      { id: 'checkout', label: 'Checkout de este commit', enabled: commit.hash !== head },
      { id: 'branch', label: 'Crear rama aquí…' },
      { id: 'tag', label: 'Crear etiqueta aquí…' },
      { type: 'separator' },
      { id: 'cherry', label: `Cherry-pick en ${currentBranch ?? 'HEAD'}`, enabled: commit.hash !== head && !!head },
      { id: 'revert', label: 'Revertir este commit', enabled: !!head },
      {
        label: `Reset de ${currentBranch ?? 'HEAD'} a este commit`,
        enabled: !!head && commit.hash !== head,
        submenu: [
          { id: 'reset:soft', label: 'Soft · conserva los cambios preparados' },
          { id: 'reset:mixed', label: 'Mixed · conserva los cambios sin preparar' },
          { id: 'reset:hard', label: 'Hard · descarta todos los cambios' }
        ]
      },
      { type: 'separator' },
      { id: 'copy-sha', label: 'Copiar SHA' },
      { id: 'copy-msg', label: 'Copiar mensaje' }
    ]
    const id = await api.contextMenu(items)
    const isMerge = commit.parents.length > 1
    if (id === 'checkout') void checkoutCommit(commit.hash)
    else if (id === 'branch') void newBranch(commit.hash)
    else if (id === 'tag') void createTag(commit.hash)
    else if (id === 'cherry') void runUndoable(`Cherry-pick de ${shortHash(commit.hash)}`, () => api.cherryPick(repo, commit.hash, isMerge), 'Cherry-pick completado', (b) => resetTo(b))
    else if (id === 'revert') void runUndoable(`Revertir ${shortHash(commit.hash)}`, () => api.revert(repo, commit.hash, isMerge), 'Commit revertido', (b) => resetTo(b))
    else if (id?.startsWith('reset:')) void reset(commit.hash, id.slice(6) as ResetMode)
    else if (id === 'copy-sha') copy(commit.hash, 'SHA')
    else if (id === 'copy-msg') copy(commit.subject, 'Mensaje')
  }

  const refMenu = async (ref: Ref): Promise<void> => {
    const isCurrent = !!ref.isHead
    const canIntegrate = !!currentBranch && !isCurrent && ref.type !== 'tag'
    const items: MenuItemSpec[] = [
      { id: 'checkout', label: ref.type === 'remote' ? 'Checkout (crea la rama local)' : ref.type === 'tag' ? 'Checkout (HEAD desacoplado)' : 'Checkout', enabled: !isCurrent },
      { type: 'separator' },
      { id: 'merge', label: `Merge de ${ref.name} en ${currentBranch ?? '…'}`, enabled: canIntegrate },
      { id: 'rebase', label: `Rebase de ${currentBranch ?? '…'} sobre ${ref.name}`, enabled: canIntegrate },
      { type: 'separator' },
      ...(isCurrent ? [{ id: 'push', label: 'Push' }, { id: 'pull', label: 'Pull' }, { type: 'separator' } as MenuItemSpec] : []),
      { id: 'branch', label: 'Crear rama aquí…' },
      { id: 'tag', label: 'Crear etiqueta aquí…', enabled: ref.type !== 'tag' },
      { type: 'separator' },
      { id: 'hide', label: isRefHidden(ref) ? 'Mostrar en el gráfico' : 'Ocultar en el gráfico', enabled: !isCurrent },
      { id: 'solo', label: 'Mostrar solo esta rama en el gráfico' },
      ...(filterActive ? [{ id: 'show-all', label: 'Mostrar todas las ramas' }] : []),
      { type: 'separator' },
      ...(ref.type === 'local' ? [{ id: 'rename', label: 'Renombrar…' }, { id: 'delete', label: 'Eliminar…', enabled: !isCurrent }] : []),
      ...(ref.type === 'remote' ? [{ id: 'delete-remote', label: 'Eliminar rama remota…' }] : []),
      ...(ref.type === 'tag' ? [{ id: 'delete-tag', label: 'Eliminar etiqueta…' }] : []),
      { type: 'separator' },
      { id: 'copy', label: 'Copiar nombre' }
    ]
    const id = await api.contextMenu(items)
    if (id === 'checkout') void checkoutRef(ref)
    else if (id === 'merge') void merge(ref.name)
    else if (id === 'rebase') void rebase(ref.name)
    else if (id === 'push') void push()
    else if (id === 'pull') pull(settings.pullMode)
    else if (id === 'branch') void newBranch(ref.hash)
    else if (id === 'tag') void createTag(ref.hash)
    else if (id === 'hide') toggleHidden([ref])
    else if (id === 'solo') setFilter({ hidden: [], solo: withUpstream(ref) })
    else if (id === 'show-all') setFilter(NO_FILTER)
    else if (id === 'rename') void renameBranch(ref)
    else if (id === 'delete') void deleteLocalBranch(ref)
    else if (id === 'delete-remote') {
      const [remote, ...rest] = ref.name.split('/')
      const branch = rest.join('/')
      if (await confirm(`¿Eliminar ${ref.name} del servidor?`, 'Eliminar', `Ejecuta git push ${remote} --delete ${branch}. Afecta a todas las personas que usan el remoto.`, true)) {
        void run('Eliminar rama remota', () => api.deleteRemoteBranch(repo, remote, branch), `${ref.name} eliminada`)
      }
    } else if (id === 'delete-tag') {
      if (await confirm(`¿Eliminar la etiqueta ${ref.name}?`, 'Eliminar', 'Solo se elimina la etiqueta local.', true)) {
        if (await run('Eliminar etiqueta', () => api.deleteTag(repo, ref.name), `Etiqueta ${ref.name} eliminada`)) await remember(`Eliminar etiqueta ${ref.name}`, () => api.createTag(repo, ref.name, ref.hash, ''))
      }
    } else if (id === 'copy') copy(ref.name, 'Nombre')
  }

  const labelMenu = (label: RefLabel): void => {
    const ref = label.local ?? label.remotes[0] ?? label.tag
    if (ref) void refMenu(ref)
    else {
      const commit = commits.find((c) => c.hash === head)
      if (commit) void commitMenu(commit)
    }
  }

  const stashMenu = async (entry: StashEntry): Promise<void> => {
    const id = await api.contextMenu([
      { id: 'pop', label: 'Aplicar y eliminar (pop)' },
      { id: 'apply', label: 'Aplicar' },
      { type: 'separator' },
      { id: 'drop', label: 'Eliminar…' }
    ])
    if (id === 'pop' || id === 'apply') void stashApply(entry, id === 'pop')
    else if (id === 'drop') void stashDrop(entry)
  }

  const branchMenu = async (): Promise<void> => {
    const locals = refs.filter((r) => r.type === 'local')
    const id = await api.contextMenu([
      ...locals.map((r) => ({ id: `co:${r.name}`, label: r.name, type: 'radio' as const, checked: !!r.isHead })),
      ...(locals.length ? [{ type: 'separator' as const }] : []),
      { id: 'new', label: 'Nueva rama…', accelerator: 'CmdOrCtrl+B' }
    ])
    if (id === 'new') void newBranch()
    else if (id?.startsWith('co:')) {
      const ref = locals.find((r) => r.name === id.slice(3))
      if (ref) void checkoutRef(ref)
    }
  }

  const fileMenu = async (file: FileChange, source: DiffSource): Promise<void> => {
    const items: MenuItemSpec[] = [{ id: 'open', label: 'Ver cambios' }]
    if (source.kind === 'unstaged') items.push({ id: 'stage', label: 'Preparar' }, { id: 'discard', label: 'Descartar cambios…' })
    if (source.kind === 'staged') items.push({ id: 'unstage', label: 'Quitar de preparados' })
    if (source.kind === 'conflict') items.push({ id: 'ours', label: 'Usar versión HEAD' }, { id: 'theirs', label: 'Usar versión entrante' }, { id: 'stage', label: 'Marcar resuelto' })
    const committed = source.kind === 'commit' || !['?', 'A'].includes(file.status)
    items.push(
      { type: 'separator' },
      { id: 'history', label: 'Ver historial del archivo', enabled: committed },
      { id: 'blame', label: 'Blame (quién cambió cada línea)', enabled: committed && file.status !== 'D' },
      { type: 'separator' },
      { id: 'copy', label: 'Copiar ruta' }
    )
    const id = await api.contextMenu(items)
    if (id === 'open') setDiff(source)
    else if (id === 'history') openFileTool('history', source)
    else if (id === 'blame') openFileTool('blame', source)
    else if (id === 'stage') void quick('No se pudo preparar', () => api.stage(repo, paths([file])))
    else if (id === 'unstage') void quick('No se pudo quitar', () => api.unstage(repo, paths([file])))
    else if (id === 'discard') void discardFiles([file])
    else if (id === 'ours' || id === 'theirs') void quick('No se pudo resolver', () => api.resolveConflict(repo, file.path, id))
    else if (id === 'copy') copy(file.path, 'Ruta')
  }

  // ── Selección ────────────────────────────────────────────────────────────

  const openFileTool = (kind: FileTool['kind'], source: DiffSource): void => {
    const rev = source.kind === 'commit' ? (source.status === 'D' ? source.parent : source.hash) : null
    setFileTool({ kind, path: source.path, rev })
  }

  const select = (hash: string, scroll = false): void => {
    setFileTool(null)
    const stashEntry = stashes.find((s) => s.hash === hash)
    setSelection(hash === WIP_HASH ? { kind: 'wip' } : stashEntry ? { kind: 'stash', index: stashEntry.index, hash } : { kind: 'commit', hash })
    if (diff?.kind === 'commit' && diff.hash !== hash) setDiff(null)
    if ((diff?.kind === 'unstaged' || diff?.kind === 'staged' || diff?.kind === 'conflict') && hash !== WIP_HASH) setDiff(null)
    if (scroll) setScrollTarget({ hash, nonce: Date.now() })
  }

  const moveSelection = (delta: number): void => {
    const order = hasWip ? [WIP_HASH, ...graphCommits.map((c) => c.hash)] : graphCommits.map((c) => c.hash)
    const index = selectedHash ? order.indexOf(selectedHash) : -1
    const next = order[clamp(index + delta, 0, order.length - 1)]
    if (next) select(next, true)
  }

  const panelActions: CommitPanelActions = {
    stage: (files) => void quick('No se pudo preparar', () => api.stage(repo, paths(files))),
    unstage: (files) => void quick('No se pudo quitar', () => api.unstage(repo, paths(files))),
    discard: (files) => void discardFiles(files),
    stageAll: () => void quick('No se pudo preparar todo', () => api.stageAll(repo)),
    unstageAll: () => void quick('No se pudo quitar todo', () => api.unstageAll(repo)),
    discardAll: () => void discardAll(),
    commit: () => void commit(),
    stageAllAndCommit: () => void stageAllAndCommit(),
    toggleAmend: (amend) => void toggleAmend(amend),
    abortOperation: () => void abortOperation(),
    continueOperation: () => void continueOperation(),
    stashApply: (entry, pop) => void stashApply(entry, pop),
    stashDrop: (entry) => void stashDrop(entry),
    copy,
    fileMenu: (file, source) => void fileMenu(file, source)
  }

  // ── Fetch automático ─────────────────────────────────────────────────────

  useEffect(() => {
    const minutes = settings.autoFetchMinutes
    if (!minutes) return
    const first = setTimeout(() => fetchAll(true), 4000)
    const timer = setInterval(() => fetchAll(true), minutes * 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [repo, settings.autoFetchMinutes])

  // ── Atajos de teclado ────────────────────────────────────────────────────

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    if (document.querySelector('.modal-backdrop')) return
    const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select, [contenteditable="true"]')
    const cmd = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    if (cmd && !e.shiftKey && key === 'p') return e.preventDefault(), setPalette(true)
    if (cmd && !e.shiftKey && !e.altKey && key === 'f') return e.preventDefault(), setDiff(null), setSearchFocus((n) => n + 1)
    if (cmd && e.altKey && key === 'f') return e.preventDefault(), onSettings({ leftVisible: true }), setFilterFocus((n) => n + 1)
    if (cmd && !e.shiftKey && key === 'b') return e.preventDefault(), void newBranch()
    if (cmd && !e.shiftKey && key === 'l') return e.preventDefault(), fetchAll()
    if (cmd && !e.shiftKey && key === 'j') return e.preventDefault(), onSettings({ leftVisible: !settings.leftVisible })
    if (cmd && !e.shiftKey && key === 'k') return e.preventDefault(), onSettings({ rightVisible: !settings.rightVisible })
    if (cmd && e.shiftKey && key === 's') return e.preventDefault(), panelActions.stageAll()
    if (cmd && e.shiftKey && key === 'u') return e.preventDefault(), panelActions.unstageAll()
    if (cmd && e.shiftKey && key === 'm') return e.preventDefault(), setSelection({ kind: 'wip' }), setSummaryFocus((n) => n + 1)
    if (cmd && key === 'enter' && !typing) return e.preventDefault(), void (e.shiftKey ? stageAllAndCommit() : commit())
    if (cmd && !e.shiftKey && key === 'z' && !typing) return e.preventDefault(), void undoLast()
    if (typing || cmd || e.altKey) return
    if (e.key === 'Escape' && fileTool) return setFileTool(null)
    if (e.key === 'Escape' && diff) return setDiff(null)
    if (e.key === 'ArrowDown' || key === 'j') return e.preventDefault(), moveSelection(1)
    if (e.key === 'ArrowUp' || key === 'k') return e.preventDefault(), moveSelection(-1)
    if (key === 's' && diff?.kind === 'unstaged') return panelActions.stage(status.unstaged.filter((f) => f.path === diff.path))
    if (key === 'u' && diff?.kind === 'staged') return panelActions.unstage(status.staged.filter((f) => f.path === diff.path))
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent): void => keyHandler.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // ── Paleta de comandos ───────────────────────────────────────────────────

  const paletteItems = (): PaletteItem[] => {
    const items: PaletteItem[] = [
      { id: 'fetch', group: 'Repositorio', label: 'Fetch de todos los remotos', hint: `${mod}L`, icon: <Icon.Download size={14} />, run: () => fetchAll() },
      { id: 'pull', group: 'Repositorio', label: 'Pull', icon: <Icon.Pull size={14} />, run: () => pull(settings.pullMode) },
      { id: 'pull-ff', group: 'Repositorio', label: 'Pull (solo fast-forward)', icon: <Icon.Pull size={14} />, run: () => pull('ff-only') },
      { id: 'pull-rebase', group: 'Repositorio', label: 'Pull (rebase)', icon: <Icon.Pull size={14} />, run: () => pull('rebase') },
      { id: 'push', group: 'Repositorio', label: 'Push', icon: <Icon.Push size={14} />, run: () => void push() },
      ...(undoStack.length ? [{ id: 'undo', group: 'Repositorio', label: `Deshacer: ${undoStack[undoStack.length - 1].label}`, hint: `${mod}Z`, icon: <Icon.Undo size={14} />, run: () => void undoLast() }] : []),
      ...(filterActive ? [{ id: 'show-all', group: 'Ver', label: 'Mostrar todas las ramas en el gráfico', icon: <Icon.Eye size={14} />, run: () => setFilter(NO_FILTER) }] : []),
      { id: 'branch', group: 'Rama', label: 'Nueva rama…', hint: `${mod}B`, icon: <Icon.Branch size={14} />, run: () => void newBranch() },
      { id: 'stash', group: 'Stash', label: 'Guardar cambios en el stash…', icon: <Icon.Stash size={14} />, run: () => void stash() },
      ...(stashes[0] ? [{ id: 'pop', group: 'Stash', label: 'Aplicar el último stash (pop)', icon: <Icon.Pop size={14} />, run: () => void stashApply(stashes[0], true) }] : []),
      { id: 'stage-all', group: 'Cambios', label: 'Preparar todo', hint: `⇧${mod}S`, icon: <Icon.Plus size={14} />, run: panelActions.stageAll },
      { id: 'unstage-all', group: 'Cambios', label: 'Quitar todo de preparados', hint: `⇧${mod}U`, icon: <Icon.Minus size={14} />, run: panelActions.unstageAll },
      { id: 'commit', group: 'Cambios', label: 'Escribir mensaje de commit', hint: `⇧${mod}M`, icon: <Icon.Commit size={14} />, run: () => (setSelection({ kind: 'wip' }), setSummaryFocus((n) => n + 1)) },
      { id: 'discard-all', group: 'Cambios', label: 'Descartar todos los cambios…', icon: <Icon.Trash size={14} />, run: () => void discardAll() },
      { id: 'search', group: 'Ver', label: 'Buscar commits', hint: `${mod}F`, icon: <Icon.Search size={14} />, run: () => (setDiff(null), setSearchFocus((n) => n + 1)) },
      { id: 'left', group: 'Ver', label: 'Mostrar u ocultar el panel izquierdo', hint: `${mod}J`, icon: <Icon.Panel size={14} />, run: () => onSettings({ leftVisible: !settings.leftVisible }) },
      { id: 'right', group: 'Ver', label: 'Mostrar u ocultar el panel derecho', hint: `${mod}K`, icon: <Icon.PanelRight size={14} />, run: () => onSettings({ rightVisible: !settings.rightVisible }) },
      { id: 'terminal', group: 'Repositorio', label: 'Abrir en Terminal', icon: <Icon.Terminal size={14} />, run: () => void api.openTerminal(repo) },
      { id: 'finder', group: 'Repositorio', label: 'Abrir carpeta', icon: <Icon.Folder size={14} />, run: () => void api.openInFinder(repo) },
      { id: 'copy-path', group: 'Repositorio', label: 'Copiar ruta del repositorio', icon: <Icon.Copy size={14} />, run: () => copy(repo, 'Ruta') },
      { id: 'open', group: 'Pestañas', label: 'Abrir repositorio…', icon: <Icon.Folder size={14} />, run: () => onOpenRepo() },
      { id: 'new-tab', group: 'Pestañas', label: 'Nueva pestaña', hint: `${mod}T`, icon: <Icon.Plus size={14} />, run: onNewTab }
    ]
    for (const ref of refs) {
      if (ref.type === 'local' && !ref.isHead) items.push({ id: `co:${ref.fullName}`, group: 'Checkout', label: ref.name, icon: <Icon.Branch size={14} />, run: () => void checkoutRef(ref) })
      if (ref.type === 'remote') items.push({ id: `co:${ref.fullName}`, group: 'Checkout', label: ref.name, icon: <Icon.Cloud size={14} />, run: () => void checkoutRef(ref) })
    }
    for (const ref of refs) {
      if (ref.type !== 'tag') items.push({ id: `go:${ref.fullName}`, group: 'Ir a', label: ref.name, icon: ref.type === 'remote' ? <Icon.Cloud size={14} /> : <Icon.Branch size={14} />, run: () => select(ref.hash, true) })
    }
    for (const path of settings.recent) {
      if (path !== repo) items.push({ id: `open:${path}`, group: 'Abrir', label: `${repoName(path)} — ${homeRelative(path)}`, icon: <Icon.Folder size={14} />, run: () => onOpenRepo(path) })
    }
    return items
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (data.error && !state) {
    return (
      <div className="repo-error">
        <Icon.Warning size={28} />
        <h2>No se pudo abrir {repoName(repo)}</h2>
        <pre>{data.error}</pre>
        <button className="btn btn-primary" onClick={() => void refreshAll()}>Reintentar</button>
      </div>
    )
  }

  const leftWidth = clamp(settings.leftWidth, 180, 480)
  const rightWidth = clamp(settings.rightWidth, 300, 640)
  const selectedStash = selection?.kind === 'stash' ? selection.index : null

  return (
    <div className="repo-view">
      <Toolbar
        repo={repo}
        state={state}
        headRef={headRef}
        busy={busy}
        stashCount={stashes.length}
        pullMode={settings.pullMode}
        leftVisible={settings.leftVisible}
        rightVisible={settings.rightVisible}
        undoLabel={undoStack[undoStack.length - 1]?.label ?? null}
        onUndo={() => void undoLast()}
        onPull={pull}
        onFetch={() => fetchAll()}
        onPullModeChange={(pullMode) => onSettings({ pullMode })}
        onPush={() => void push()}
        onBranch={() => void newBranch()}
        onStash={() => void stash()}
        onPop={() => stashes[0] && void stashApply(stashes[0], true)}
        onTerminal={() => void api.openTerminal(repo)}
        onPalette={() => setPalette(true)}
        onBranchMenu={() => void branchMenu()}
        onToggleLeft={() => onSettings({ leftVisible: !settings.leftVisible })}
        onToggleRight={() => onSettings({ rightVisible: !settings.rightVisible })}
      />
      <div className="workspace">
        {settings.leftVisible && (
          <>
            <div style={{ width: leftWidth, flex: 'none', display: 'flex' }}>
              <LeftPanel
                refs={refs}
                remotes={data.remotes}
                filter={filter}
                stashes={stashes}
                submodules={data.submodules}
                selectedStash={selectedStash}
                filterFocus={filterFocus}
                onSelectRef={(ref) => select(ref.hash, true)}
                onActivateRef={(ref) => void checkoutRef(ref)}
                onRefMenu={(ref) => void refMenu(ref)}
                onHoverRef={(ref) => setHighlight(ref?.hash ?? null)}
                onToggleHidden={toggleHidden}
                onClearFilter={() => setFilter(NO_FILTER)}
                onSelectStash={(entry) => {
                  setSelection({ kind: 'stash', index: entry.index, hash: entry.hash })
                  setScrollTarget({ hash: entry.hash, nonce: Date.now() })
                  setDiff(null)
                }}
                onStashMenu={(entry) => void stashMenu(entry)}
                onOpenSubmodule={(path) => onOpenRepo(`${repo}/${path}`)}
              />
            </div>
            <Resizer side="left" onResize={(d) => onSettings({ leftWidth: clamp(leftWidth + d, 180, 480) })} />
          </>
        )}
        <main className="center">
          {fileTool?.kind === 'history' ? (
            <FileHistory
              repo={repo}
              path={fileTool.path}
              mode={settings.diffMode}
              wrap={settings.wrap}
              onModeChange={(diffMode) => onSettings({ diffMode })}
              onWrapChange={(wrap) => onSettings({ wrap })}
              onClose={() => setFileTool(null)}
              onBlame={(rev) => setFileTool({ kind: 'blame', path: fileTool.path, rev })}
              onSelectCommit={(hash) => select(hash, true)}
            />
          ) : fileTool?.kind === 'blame' ? (
            <BlameView
              repo={repo}
              path={fileTool.path}
              rev={fileTool.rev}
              onClose={() => setFileTool(null)}
              onHistory={() => setFileTool({ kind: 'history', path: fileTool.path, rev: null })}
              onSelectCommit={(hash) => select(hash, true)}
            />
          ) : diff ? (
            <DiffView
              repo={repo}
              source={diff}
              mode={settings.diffMode}
              wrap={settings.wrap}
              version={data.statusVersion}
              onModeChange={(diffMode) => onSettings({ diffMode })}
              onWrapChange={(wrap) => onSettings({ wrap })}
              onClose={() => setDiff(null)}
              onChanged={() => void refreshStatus()}
              onStageFile={() => void quick('No se pudo preparar', () => api.stage(repo, [diff.path]))}
              onUnstageFile={() => void quick('No se pudo quitar', () => api.unstage(repo, diff.kind === 'staged' && diff.oldPath ? [diff.oldPath, diff.path] : [diff.path]))}
              onDiscardFile={() => {
                const file = status.unstaged.find((f) => f.path === diff.path)
                if (file) void discardFiles([file])
              }}
              onResolveConflict={(side) => void quick('No se pudo resolver', () => api.resolveConflict(repo, diff.path, side))}
              onHistory={() => openFileTool('history', diff)}
              onBlame={() => openFileTool('blame', diff)}
            />
          ) : (
            <GraphView
              commits={graphCommits}
              graph={graph}
              hasWip={hasWip}
              status={status}
              labels={labels}
              head={head}
              selected={selectedHash}
              highlight={highlight}
              wipSummary={draft.summary}
              filterActive={filterActive}
              onWipSummary={(summary) => setDraft({ ...draft, summary })}
              onClearFilter={() => setFilter(NO_FILTER)}
              columns={settings.columns}
              canLoadMore={commits.length >= data.limit}
              scrollTarget={scrollTarget}
              searchFocus={searchFocus}
              onColumnsChange={(columns) => onSettings({ columns })}
              onSelect={(hash) => select(hash)}
              onCommitMenu={(c) => void commitMenu(c)}
              onLabelMenu={labelMenu}
              onLabelActivate={activateLabel}
              onLabelDrop={(source, target) => void dropLabel(source, target)}
              onCommitActivate={activateCommit}
              onLoadMore={loadMore}
            />
          )}
        </main>
        {settings.rightVisible && (
          <>
            <Resizer side="right" onResize={(d) => onSettings({ rightWidth: clamp(rightWidth + d, 300, 640) })} />
            <div style={{ width: rightWidth, flex: 'none', display: 'flex' }}>
              <CommitPanel
                repo={repo}
                selection={selection}
                status={status}
                state={state}
                stashes={stashes}
                activeDiff={diff}
                draft={draft}
                version={data.statusVersion}
                onDraft={setDraft}
                onOpenDiff={setDiff}
                onSelectCommit={(hash) => select(hash, true)}
                actions={panelActions}
                summaryFocus={summaryFocus}
                fileView={settings.fileView}
                onFileView={(fileView) => onSettings({ fileView })}
              />
            </div>
          </>
        )}
      </div>
      <footer className="status-bar">
        <span className="sb-item"><Icon.Folder size={12} /> {homeRelative(repo)}</span>
        {state?.branch && (
          <span className="sb-item">
            <Icon.Branch size={12} /> {state.branch}
            {headRef?.upstream && <span className="muted"> → {headRef.upstream}</span>}
            {!!headRef?.ahead && <span className="ahead"> ↑{headRef.ahead}</span>}
            {!!headRef?.behind && <span className="behind"> ↓{headRef.behind}</span>}
          </span>
        )}
        {state?.detached && <span className="sb-item warn">HEAD desacoplado en {shortHash(state.head!)}</span>}
        {state?.operation && <span className="sb-item warn"><Icon.Warning size={12} /> {state.operation} en curso</span>}
        {filterActive && (
          <button className="sb-item sb-link warn" onClick={() => setFilter(NO_FILTER)} title="Mostrar todas las ramas">
            <Icon.EyeOff size={12} /> {filter.solo.length ? 'Gráfico filtrado' : `${filter.hidden.length} ${filter.hidden.length === 1 ? 'rama oculta' : 'ramas ocultas'}`}
          </button>
        )}
        <span className="spacer" />
        {lastFetch && <span className="sb-item muted">Último fetch {relativeTime(lastFetch)}</span>}
        <span className="sb-item muted">{commits.length.toLocaleString('es')} commits</span>
      </footer>
      {palette && <CommandPalette items={paletteItems()} onClose={() => setPalette(false)} />}
    </div>
  )
}
