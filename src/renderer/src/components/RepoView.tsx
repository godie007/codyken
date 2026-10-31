import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Commit, DiffSource, EditTarget, FetchResult, FileChange, GraphFilter, MenuItemSpec, PullMode, PullRequest, PullRequestInfo, RebaseMode, RebaseStep, Ref, RepoState, ResetMode, Settings, StashEntry, Worktree } from '../../../shared/types'
import { api, mod } from '../api'
import { homeRelative, ltr, relativeTime, repoName, shortHash } from '../lib/format'
import { computeGraph, WIP_HASH, withStashes } from '../lib/graph'
import { planDrop, dropTargetRef, type DropAction, type DropTarget } from '../lib/drop'
import { labelsByCommit, remoteBranchName, remoteTwin, type RefLabel } from '../lib/refs'
import { planBulkDelete, type BulkDeletePlan } from '../lib/bulkdelete'
import { BulkDeleteDialog } from './BulkDeleteDialog'
import { useRepoData } from '../useRepoData'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { CommitPanel, type CommitDraft, type CommitPanelActions, type CompareEnd, type Selection } from './CommitPanel'
import { DiffView } from './DiffView'
import { dropEditorDraft, FileEditor, type EditorRequest } from './FileEditor'
import { BlameView, FileHistory } from './FileTools'
import { GraphView } from './GraphView'
import { Icon } from './Icons'
import { LeftPanel } from './LeftPanel'
import { MergeEditor } from './MergeEditor'
import { RebaseDialog } from './RebaseDialog'
import { RepoSwitcher } from './RepoList'
import { Toolbar } from './Toolbar'
import { Resizer, usePrompt, useToast } from './ui'

const drafts = new Map<string, CommitDraft>()
/** Archivo abierto en el editor de cada repo, para recuperarlo al volver a su pestaña */
const openEditors = new Map<string, EditorRequest>()
const EMPTY_DRAFT: CommitDraft = { summary: '', body: '', amend: false }
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const NO_FILTER: GraphFilter = { hidden: [], solo: [] }
const UNDO_LIMIT = 20

/**
 * Una acción que se puede deshacer y rehacer. En la pila de deshacer, head/branch son el estado que dejó la acción;
 * en la de rehacer, el que dejó el deshacer. Solo es válida mientras el repo siga en ese estado.
 */
interface UndoEntry {
  label: string
  head: string | null
  branch: string | null
  /** El deshacer usa reset --hard: exige no tener cambios sin confirmar */
  hard: boolean
  undo: () => Promise<unknown>
  redo: (() => Promise<unknown>) | null
  redoHard: boolean
}

/** Cómo deshacer una operación que movió HEAD; `mode` es el reset que se usará también al rehacer. */
interface UndoPlan {
  undo: () => Promise<unknown>
  hard?: boolean
  mode?: ResetMode
  /** Rehacer a medida (por defecto vuelve a dejar la rama donde la dejó la operación) */
  redo?: () => Promise<unknown>
  /** Se llama después del rehacer genérico */
  onRedo?: () => void
}

type FileTool = { kind: 'history' | 'blame'; path: string; rev: string | null }

export interface RepoViewProps {
  repo: string
  settings: Settings
  onSettings: (patch: Partial<Settings>) => void
  onOpenRepo: (path?: string) => void
  onNewTab: () => void
  /** Repos con pestaña abierta, para marcarlos en la lista de recientes */
  openRepos: string[]
  onRemoveRecent: (paths: string[]) => void
}

export function RepoView({ repo, settings, onSettings, onOpenRepo, onNewTab, openRepos, onRemoveRecent }: RepoViewProps) {
  const filter = settings.graphFilters[repo] ?? NO_FILTER
  const { data, refreshAll, refreshStatus, loadMore } = useRepoData(repo, filter)
  const { toast } = useToast()
  const prompt = usePrompt()
  const [selection, setSelection] = useState<Selection>(null)
  const [diff, setDiff] = useState<DiffSource | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [bulkDelete, setBulkDelete] = useState<BulkDeletePlan | null>(null)
  const [selectionReset, setSelectionReset] = useState(0)
  const busyRef = useRef<string | null>(null)
  const [palette, setPalette] = useState(false)
  const [repoMenu, setRepoMenu] = useState(false)
  const closeRepoMenu = useCallback(() => setRepoMenu(false), [])
  const [scrollTarget, setScrollTarget] = useState<{ hash: string; nonce: number } | null>(null)
  const [searchFocus, setSearchFocus] = useState(0)
  const [filterFocus, setFilterFocus] = useState(0)
  const [summaryFocus, setSummaryFocus] = useState(0)
  const [draft, setDraftState] = useState<CommitDraft>(drafts.get(repo) ?? EMPTY_DRAFT)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [fileTool, setFileTool] = useState<FileTool | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([])
  /** Rebase interactivo abierto: desde un commit de la rama actual, o de `tip` sobre otra rama */
  const [rebasePlan, setRebasePlan] = useState<{ base: string; mode: RebaseMode; tip?: string; baseName?: string } | null>(null)
  const [prs, setPrs] = useState<PullRequestInfo | null>(null)
  const [editor, setEditorState] = useState<EditorRequest | null>(() => openEditors.get(repo) ?? null)
  const editorDirty = useRef(false)
  /** Tras preparar una versión editada, mostrar su diff preparado en cuanto llegue el estado nuevo */
  const followStaged = useRef<{ path: string; until: number } | null>(null)
  const [prsLoading, setPrsLoading] = useState(false)

  const { commits, refs, state, status, stashes } = data
  const head = state?.head ?? null
  const currentBranch = state?.branch ?? null
  const hasWip = status.staged.length + status.unstaged.length + status.conflicted.length > 0
  const hasTrackedChanges = status.staged.length + status.conflicted.length + status.unstaged.filter((f) => f.status !== '?').length > 0
  const filterActive = filter.hidden.length > 0 || filter.solo.length > 0
  const headRef = refs.find((r) => r.type === 'local' && r.isHead)
  const labels = useMemo(() => labelsByCommit(refs, state?.detached ? head : null), [refs, state?.detached, head])
  const graphCommits = useMemo(() => withStashes(commits, stashes), [commits, stashes])
  const graph = useMemo(
    () => computeGraph(hasWip ? [{ hash: WIP_HASH, parents: head ? [head] : [] }, ...graphCommits] : graphCommits, hasWip ? WIP_HASH : head),
    [graphCommits, hasWip, head]
  )
  const selectedHash = selection?.kind === 'wip' ? WIP_HASH : selection?.kind === 'compare' ? selection.target.hash : selection ? selection.hash : null
  const compareBase = selection?.kind === 'compare' ? selection.base.hash : null

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
    const follow = followStaged.current
    if (follow && data.loaded) {
      const file = status.staged.find((f) => f.path === follow.path)
      if (file || Date.now() > follow.until) followStaged.current = null
      if (file) return setDiff({ kind: 'staged', path: file.path, oldPath: file.oldPath, status: file.status })
    }
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

  /** Una acción nueva invalida lo que se podía rehacer */
  const pushUndo = (entry: UndoEntry): void => {
    setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), entry])
    setRedoStack([])
  }

  /** Registra una acción que no mueve HEAD (ramas, etiquetas): `redo` repite la acción original. */
  const remember = async (label: string, undo: () => Promise<unknown>, redo: (() => Promise<unknown>) | null, hard = false): Promise<void> => {
    const after = await api.getRepoState(repo).catch(() => null)
    if (after && !after.operation) pushUndo({ label, head: after.head, branch: after.branch, hard, undo, redo, redoHard: false })
  }

  /** Ejecuta una operación que mueve HEAD y registra cómo volver al estado anterior (y cómo rehacerla). */
  const runUndoable = async (label: string, fn: () => Promise<unknown>, success: string, makeUndo: (before: RepoState) => UndoPlan | null): Promise<boolean> => {
    const before = await api.getRepoState(repo).catch(() => null)
    const ok = await run(label, fn, success)
    if (!ok || !before) return ok
    const after = await api.getRepoState(repo).catch(() => null)
    if (!after || after.operation || (after.head === before.head && after.branch === before.branch)) return ok
    const plan = makeUndo(before)
    if (!plan) return ok
    const mode = plan.mode ?? (plan.hard ? 'hard' : 'soft')
    pushUndo({ label, head: after.head, branch: after.branch, hard: !!plan.hard, undo: plan.undo, redo: plan.redo ?? (async () => (await redoTo(after, mode)(), plan.onRedo?.())), redoHard: mode === 'hard' })
    return ok
  }

  const backTo = (before: RepoState) => () =>
    before.branch ? api.checkout(repo, { kind: 'local', name: before.branch }) : api.checkout(repo, { kind: 'commit', hash: before.head! })

  const resetTo = (before: RepoState, mode: ResetMode = 'hard'): UndoPlan | null =>
    before.head ? { undo: () => api.reset(repo, before.head!, mode), hard: mode === 'hard', mode } : null

  /** Rehacer genérico: volver a la rama que dejó la operación y ponerla en el commit que dejó. */
  const redoTo = (after: RepoState, mode: ResetMode) => async (): Promise<void> => {
    const now = await api.getRepoState(repo)
    if (after.branch && now.branch !== after.branch) await api.checkout(repo, { kind: 'local', name: after.branch })
    else if (!after.branch && after.head && (now.branch || now.head !== after.head)) return void (await api.checkout(repo, { kind: 'commit', hash: after.head }))
    const current = await api.getRepoState(repo)
    if (after.head && current.head !== after.head) await api.reset(repo, after.head, mode)
  }

  /** Comprueba que el repo siga en el estado de la entrada; si no, vacía la pila para no deshacer algo distinto. */
  const entryValid = async (entry: UndoEntry, clear: () => void): Promise<boolean> => {
    const now = await api.getRepoState(repo)
    if (now.head === entry.head && now.branch === entry.branch && !now.operation) return true
    clear()
    toast('info', 'Ya no se puede', 'El repositorio cambió desde la última acción (quizá desde la terminal).')
    return false
  }

  const undoLast = async (): Promise<void> => {
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return toast('info', 'No hay nada que deshacer')
    if (busyRef.current) return toast('info', `Espera a que termine: ${busyRef.current}`)
    if (!(await entryValid(entry, () => (setUndoStack([]), setRedoStack([]))))) return
    if (entry.hard) {
      if (hasTrackedChanges) return toast('error', `No se puede deshacer "${entry.label}"`, 'Tienes cambios sin confirmar. Haz commit o stash primero.')
      if (!(await confirm(`¿Deshacer "${entry.label}"?`, 'Deshacer', 'Los commits creados por esa acción dejarán de estar en la rama (podrás rehacerla).'))) return
    }
    const ok = await run('Deshacer', entry.undo, `Deshecho: ${entry.label}`)
    if (!ok) return
    setUndoStack((stack) => stack.slice(0, -1))
    const after = await api.getRepoState(repo).catch(() => null)
    if (entry.redo && after && !after.operation) setRedoStack((stack) => [...stack, { ...entry, head: after.head, branch: after.branch }])
  }

  const redoLast = async (): Promise<void> => {
    const entry = redoStack[redoStack.length - 1]
    if (!entry?.redo) return toast('info', 'No hay nada que rehacer')
    if (busyRef.current) return toast('info', `Espera a que termine: ${busyRef.current}`)
    if (!(await entryValid(entry, () => setRedoStack([])))) return
    if (entry.redoHard && hasTrackedChanges) return toast('error', `No se puede rehacer "${entry.label}"`, 'Tienes cambios sin confirmar. Haz commit o stash primero.')
    const ok = await run('Rehacer', entry.redo, `Rehecho: ${entry.label}`)
    if (!ok) return
    setRedoStack((stack) => stack.slice(0, -1))
    const after = await api.getRepoState(repo).catch(() => null)
    if (after && !after.operation) setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), { ...entry, head: after.head, branch: after.branch }])
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

  /** Fetch de todos los remotos; además adelanta las ramas locales que solo estaban atrasadas (la actual solo a mano). */
  const fetchAll = (silent = false): void => {
    if (silent) {
      api.fetch(repo).then(
        () => (setLastFetch(Date.now()), void refreshAll()),
        () => {}
      )
      void loadPrs()
      return
    }
    void loadPrs()
    void (async () => {
      let result: FetchResult | null = null
      const ok = await run('Fetch', async () => {
        result = await api.fetch(repo, { updateCurrent: true })
        setLastFetch(Date.now())
      })
      if (!ok || !result) return
      const { updated, diverged, skipped, unshallowed } = result as FetchResult
      const names = (list: string[]): string => (list.length > 3 ? `${list.slice(0, 3).join(', ')} y ${list.length - 3} más` : list.join(', '))
      const lines = [
        unshallowed && 'Se trajo la historia completa (el clon era superficial).',
        updated.length > 0 && `${updated.length === 1 ? 'Rama adelantada' : `${updated.length} ramas adelantadas`} hasta su remota: ${names(updated.map((u) => u.branch))}.`,
        diverged.length > 0 && `${names(diverged)} ${diverged.length === 1 ? 'tiene' : 'tienen'} commits propios y del remoto: haz pull (merge o rebase).`,
        ...skipped.map((k) => `${k.branch} no se adelantó: ${k.reason}.`)
      ].filter(Boolean) as string[]
      toast(diverged.length || skipped.length ? 'info' : 'success', 'Fetch completado', lines.join('\n') || 'Todas las ramas locales están al día.')
      if (!updated.length) return
      // Deshacer devuelve las ramas locales a donde estaban (las remotas siguen actualizadas)
      const current = updated.find((u) => u.current)
      const others = updated.filter((u) => !u.current)
      const after = await api.getRepoState(repo).catch(() => null)
      if (!after || after.operation) return
      pushUndo({
        label: `Adelantar ${updated.length === 1 ? updated[0].branch : `${updated.length} ramas`} tras el fetch`,
        head: after.head,
        branch: after.branch,
        hard: !!current,
        redoHard: !!current,
        undo: async () => {
          for (const u of others) await api.moveBranch(repo, u.branch, u.from)
          if (current) await api.reset(repo, current.from, 'hard')
        },
        redo: async () => {
          for (const u of others) await api.moveBranch(repo, u.branch, u.to)
          if (current) await api.reset(repo, current.to, 'hard')
        }
      })
    })()
  }

  // ── Pull requests ────────────────────────────────────────────────────────

  const loadPrs = useCallback(async (): Promise<void> => {
    setPrsLoading(true)
    try {
      setPrs(await api.getPullRequests(repo))
    } catch {
      setPrs(null)
    } finally {
      setPrsLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void loadPrs()
  }, [loadPrs])

  const prWord = prs?.provider === 'gitlab' ? 'merge request' : 'pull request'

  const openUrl = (url: string): void => {
    api.openExternal(url).catch((e) => toast('error', 'No se pudo abrir el enlace', errorText(e)))
  }

  /**
   * Abre la página del proveedor para crear el PR de una rama (la persona lo revisa y lo envía allí).
   * Si la rama no está subida, ofrece subirla primero; `base` elige la rama de destino.
   */
  const createPr = async (branch = currentBranch, upstream = headRef?.upstream, base?: string): Promise<void> => {
    if (!prs?.webUrl) return toast('info', `El remoto no es de GitHub ni de GitLab: no se puede crear un ${prWord} desde aquí`)
    if (!branch) return toast('error', 'No estás en ninguna rama')
    if (!upstream) {
      const ok = await confirm(`${branch} todavía no está en el remoto`, 'Hacer push', `Para crear el ${prWord} primero hay que subir la rama.`)
      if (!ok) return
      const remote = prs.remote ?? 'origin'
      if (branch === currentBranch) await push()
      else await run('Push', () => api.pushBranch(repo, branch, remote, branch, { setUpstream: true }), `${branch} subida a ${remote}`)
      const pushed = (await api.getRefs(repo).catch(() => [])).find((r) => r.type === 'local' && r.name === branch)
      if (!pushed?.upstream) return
      upstream = pushed.upstream
    }
    const remoteBranch = upstream.slice(upstream.indexOf('/') + 1)
    const path = (name: string): string => name.split('/').map(encodeURIComponent).join('/')
    openUrl(
      prs.provider === 'gitlab'
        ? `${prs.webUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(remoteBranch)}${base ? `&merge_request%5Btarget_branch%5D=${encodeURIComponent(base)}` : ''}`
        : base
          ? `${prs.webUrl}/compare/${path(base)}...${path(remoteBranch)}?expand=1`
          : `${prs.webUrl}/pull/new/${path(remoteBranch)}`
    )
  }

  /** La rama del PR tal como la conocemos: local con ese nombre o remota en origin */
  const prRef = (pr: PullRequest): Ref | undefined =>
    refs.find((r) => r.type === 'local' && r.name === pr.head) ?? refs.find((r) => r.type === 'remote' && r.name.slice(r.remote!.length + 1) === pr.head)
  const prBaseRef = (pr: PullRequest): Ref | undefined =>
    refs.find((r) => r.type === 'remote' && r.name.slice(r.remote!.length + 1) === pr.base) ?? refs.find((r) => r.type === 'local' && r.name === pr.base)

  const selectPr = (pr: PullRequest): void => {
    const ref = prRef(pr)
    if (ref) select(ref.hash, true)
    else toast('info', `La rama ${pr.head} no está en tu repo`, 'Haz fetch o checkout del pull request para traerla.')
  }

  const checkoutPr = (pr: PullRequest): void => {
    void runUndoable(`Checkout de #${pr.number}`, () => api.checkoutPullRequest(repo, pr.number), `Ahora estás en el ${prWord} #${pr.number}`, (b) => (b.head ? { undo: backTo(b) } : null))
  }

  const prMenu = async (pr: PullRequest): Promise<void> => {
    const head = prRef(pr)
    const baseRef = prBaseRef(pr)
    const id = await api.contextMenu([
      { id: 'open', label: 'Abrir en el navegador' },
      { id: 'checkout', label: `Checkout del ${prWord}` },
      { id: 'compare', label: `Comparar ${pr.head} con ${pr.base}`, enabled: !!head && !!baseRef },
      { type: 'separator' },
      { id: 'copy', label: 'Copiar enlace' }
    ])
    if (id === 'open') openUrl(pr.url)
    else if (id === 'checkout') checkoutPr(pr)
    else if (id === 'compare' && head && baseRef) startCompare({ hash: baseRef.hash, label: baseRef.name }, { hash: head.hash, label: head.name })
    else if (id === 'copy') copy(pr.url, 'Enlace')
  }

  // ── Worktrees y LFS ──────────────────────────────────────────────────────

  const newWorktree = async (branch?: string): Promise<void> => {
    const parent = await api.pickDirectory('¿En qué carpeta crear el worktree?')
    if (!parent) return
    const exists = (name: string): boolean => refs.some((r) => r.type === 'local' && r.name === name)
    const result = await prompt({
      title: 'Nuevo worktree',
      label: `Rama que se abrirá en ${homeRelative(parent)}/…`,
      placeholder: 'feature/en-paralelo',
      initial: branch,
      confirmLabel: 'Crear worktree',
      checkboxLabel: 'Crear una rama nueva desde HEAD',
      checkboxDefault: !branch,
      validate: (v) => (/\s/.test(v) ? 'El nombre no puede tener espacios' : null)
    })
    if (!result) return
    if (result.checked && exists(result.value)) return toast('error', `Ya existe la rama ${result.value}`, 'Desmarca "Crear una rama nueva" para usarla.')
    if (!result.checked && !exists(result.value)) return toast('error', `No existe la rama ${result.value}`, 'Marca "Crear una rama nueva" para crearla.')
    const folder = `${parent}/${repoName(repo)}-${result.value.replace(/[^\w.-]+/g, '-')}`
    let created: string | null = null
    const ok = await run('Crear worktree', async () => {
      created = await api.addWorktree(repo, folder, result.value, result.checked)
    }, `Worktree creado en ${homeRelative(folder)}`)
    if (ok && created) onOpenRepo(created)
  }

  const worktreeMenu = async (tree: Worktree): Promise<void> => {
    const current = tree.path === repo
    const id = await api.contextMenu([
      { id: 'open', label: current ? 'Es el worktree de esta pestaña' : 'Abrir en una pestaña', enabled: !current && !tree.prunable },
      { id: 'copy', label: 'Copiar ruta' },
      { type: 'separator' },
      { id: 'remove', label: 'Eliminar worktree…', enabled: !tree.isMain && !current },
      ...(tree.prunable ? [{ id: 'prune', label: 'Limpiar worktrees que ya no existen' }] : [])
    ])
    if (id === 'open') onOpenRepo(tree.path)
    else if (id === 'copy') copy(tree.path, 'Ruta')
    else if (id === 'prune') void run('Limpiar worktrees', () => api.pruneWorktrees(repo), 'Worktrees limpiados')
    else if (id === 'remove') {
      const ok = await confirm(`¿Eliminar el worktree ${homeRelative(tree.path)}?`, 'Eliminar', `Se borra esa carpeta. La rama${tree.branch ? ` ${tree.branch}` : ''} y sus commits se conservan.`, true)
      if (!ok) return
      try {
        await api.removeWorktree(repo, tree.path, false)
        toast('success', 'Worktree eliminado')
      } catch (e) {
        if (/modified or untracked|contains modified|is dirty/i.test(errorText(e))) {
          const force = await confirm('El worktree tiene cambios sin confirmar', 'Eliminar de todos modos', 'Esos cambios se perderán.', true)
          if (force) await run('Eliminar worktree', () => api.removeWorktree(repo, tree.path, true), 'Worktree eliminado')
        } else toast('error', 'No se pudo eliminar el worktree', errorText(e))
      } finally {
        void refreshAll()
      }
    }
  }

  const lfsTrack = async (): Promise<void> => {
    const result = await prompt({
      title: 'Seguir con Git LFS',
      label: 'Los archivos que coincidan se guardarán en LFS (se modifica .gitattributes)',
      placeholder: '*.psd',
      confirmLabel: 'Seguir',
      validate: (v) => (v.startsWith('-') ? 'Patrón no válido' : null)
    })
    if (result) await run('LFS', () => api.lfsTrack(repo, result.value), `${result.value} se guardará en LFS. Haz commit de .gitattributes.`)
  }

  const lfsPatternMenu = async (pattern: string): Promise<void> => {
    const id = await api.contextMenu([{ id: 'untrack', label: `Dejar de seguir ${pattern}` }])
    if (id === 'untrack') await run('LFS', () => api.lfsUntrack(repo, pattern), `${pattern} ya no se guarda en LFS`)
  }

  const lfsPull = (): void => void run('Descargar LFS', () => api.lfsPull(repo), 'Archivos LFS descargados')

  // ── Comparar y rebase interactivo ────────────────────────────────────────

  /** Nombre corto de un commit para mostrar: su rama (o etiqueta) si tiene, si no el SHA */
  const nameOf = (hash: string): string => {
    const list = labels.get(hash) ?? []
    const label = list.find((l) => l.isHead) ?? list.find((l) => l.local) ?? list[0]
    return label?.name ?? shortHash(hash)
  }

  const startCompare = (base: CompareEnd, target: CompareEnd): void => {
    if (base.hash === target.hash) return toast('info', 'Es el mismo commit: no hay nada que comparar')
    setFileTool(null)
    setDiff(null)
    setSelection({ kind: 'compare', base, target })
    setScrollTarget({ hash: target.hash, nonce: Date.now() })
  }

  const closeCompare = (): void => {
    if (selection?.kind !== 'compare') return
    setDiff(null)
    setSelection({ kind: 'commit', hash: selection.target.hash })
  }

  /** Commits alcanzables desde HEAD entre los cargados: solo esos admiten rebase interactivo */
  const ancestorsOfHead = (): Set<string> => {
    const byHash = new Map(commits.map((c) => [c.hash, c]))
    const seen = new Set<string>()
    const stack = head ? [head] : []
    while (stack.length) {
      const hash = stack.pop()!
      if (seen.has(hash)) continue
      seen.add(hash)
      stack.push(...(byHash.get(hash)?.parents ?? []))
    }
    return seen
  }

  const startRebase = async (steps: RebaseStep[]): Promise<void> => {
    const plan = rebasePlan
    setRebasePlan(null)
    if (!plan) return
    if (hasTrackedChanges && !(await confirm('Tienes cambios sin confirmar', 'Continuar', 'Se guardan en un stash automático durante el rebase y se restauran al terminar.'))) return
    if (plan.mode === 'from') {
      await runUndoable(`Rebase interactivo de ${currentBranch ?? 'HEAD'}`, () => api.interactiveRebase(repo, plan.base, steps), 'Rebase interactivo completado', (b) => resetTo(b))
      return
    }
    // Sobre otra rama: se cambia a la rama que se reescribe y, al deshacer, se vuelve a donde se estaba
    const tip = plan.tip!
    const tipRef = refs.find((r) => r.type === 'local' && r.name === tip)
    if (!tipRef) return toast('error', `La rama ${tip} ya no existe`)
    const needsCheckout = tip !== currentBranch
    await runUndoable(
      `Rebase interactivo de ${tip} sobre ${plan.baseName}`,
      async () => {
        if (needsCheckout) await api.checkout(repo, { kind: 'local', name: tip })
        await api.interactiveRebase(repo, plan.base, steps, 'onto')
      },
      `${tip} ahora está sobre ${plan.baseName}`,
      (before) => ({
        hard: true,
        undo: async () => {
          await api.reset(repo, tipRef.hash, 'hard')
          if (needsCheckout && before.head) await backTo(before)()
        }
      })
    )
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
    const from = start ?? before?.head ?? 'HEAD'
    const ok = await run('Crear rama', () => api.createBranch(repo, result.value, from, result.checked), `Rama ${result.value} creada`)
    if (ok && before)
      await remember(
        `Crear rama ${result.value}`,
        async () => {
          if (result.checked && before.head) await backTo(before)()
          await api.deleteBranch(repo, result.value, true)
        },
        () => api.createBranch(repo, result.value, from, result.checked)
      )
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
    if (commit.stash !== undefined) {
      const entry = stashes.find((s) => s.index === commit.stash)
      if (entry) void stashApply(entry, false)
      return
    }
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

  // ── Arrastrar y soltar ramas ─────────────────────────────────────────────

  /** La etiqueta del gráfico que representa una rama del panel (local y remota juntas si están en el mismo commit) */
  const labelForRef = (ref: Ref): RefLabel =>
    labels.get(ref.hash)?.find((l) => l.local?.fullName === ref.fullName || l.remotes.some((r) => r.fullName === ref.fullName)) ??
    (ref.type === 'local'
      ? { key: ref.fullName, kind: 'branch', name: ref.name, local: ref, remotes: [], isHead: !!ref.isHead }
      : { key: ref.fullName, kind: 'branch', name: ref.name, remotes: [ref], isHead: false })

  const dropRef = async (sourceName: string, target: DropTarget): Promise<void> => {
    const source = refs.find((r) => r.fullName === sourceName && r.type !== 'tag')
    if (!source) return
    const against = dropTargetRef(source, target, refs)
    const div = against ? await api.divergence(repo, source.fullName, against.fullName).catch(() => null) : null
    if (against && !div) return toast('error', 'No se pudo comparar las ramas')
    const items = planDrop(source, target, div, { refs, currentBranch, prRemote: prs?.webUrl ? prs.remote : null, prWord })
    if (!items.length) return
    const id = await api.contextMenu(items.map((item, i): MenuItemSpec => (item.separator ? { type: 'separator' } : { id: String(i), label: item.label, enabled: !!item.action })))
    const action = id === null ? undefined : items[Number(id)]?.action
    if (action) await runDrop(action)
  }

  const runDrop = async (action: DropAction): Promise<void> => {
    switch (action.id) {
      case 'ff': {
        const label = `Fast-forward de ${action.branch} a ${action.toName}`
        if (action.current) {
          await runUndoable(label, () => api.fastForward(repo, action.branch, action.to), `${action.branch} avanzó hasta ${action.toName}`, (b) => resetTo(b))
          return
        }
        const before = refs.find((r) => r.type === 'local' && r.name === action.branch)
        const to = refs.find((r) => r.fullName === action.to)
        if (!before || !to) return
        if (await run(label, () => api.fastForward(repo, action.branch, action.to), `${action.branch} avanzó hasta ${action.toName}`)) {
          await remember(label, () => api.moveBranch(repo, action.branch, before.hash), () => api.moveBranch(repo, action.branch, to.hash))
        }
        return
      }
      case 'merge': {
        const target = refs.find((r) => r.type === 'local' && r.name === action.into)
        if (!target) return
        await runUndoable(
          `Merge de ${action.sourceName} en ${action.into}`,
          async () => {
            if (!action.current) await api.checkout(repo, { kind: 'local', name: action.into })
            await api.merge(repo, action.source)
          },
          `Merge de ${action.sourceName} en ${action.into} completado`,
          (before) => ({
            hard: true,
            undo: async () => {
              await api.reset(repo, target.hash, 'hard')
              if (!action.current && before.head) await backTo(before)()
            }
          })
        )
        return
      }
      case 'rebase': {
        const branch = refs.find((r) => r.type === 'local' && r.name === action.branch)
        if (!branch) return
        const ok = await confirm(`¿Hacer rebase de ${action.branch} sobre ${action.ontoName}?`, 'Rebase', 'Reescribe los commits de la rama. Si ya la compartiste, tendrás que forzar el push.')
        if (!ok) return
        await runUndoable(
          `Rebase de ${action.branch} sobre ${action.ontoName}`,
          async () => {
            if (!action.current) await api.checkout(repo, { kind: 'local', name: action.branch })
            await api.rebase(repo, action.onto)
          },
          `Rebase de ${action.branch} sobre ${action.ontoName} completado`,
          (before) => ({
            hard: true,
            undo: async () => {
              await api.reset(repo, branch.hash, 'hard')
              if (!action.current && before.head) await backTo(before)()
            }
          })
        )
        return
      }
      case 'rebase-i':
        if (state?.operation) return toast('error', 'Hay otra operación en curso', 'Termínala o abórtala primero.')
        setRebasePlan({ base: action.onto, mode: 'onto', tip: action.branch, baseName: action.ontoName })
        return
      case 'push': {
        const where = `${action.remote}/${action.remoteBranch}`
        if (action.force) {
          const ok = await confirm(
            `${where} tiene commits que ${action.branch} no tiene`,
            'Forzar push',
            'Se sobrescribe la rama remota con --force-with-lease: solo si nadie la cambió desde tu último fetch. Los commits que solo están allí dejarán de estar en la rama.',
            true
          )
          if (!ok) return
        }
        await run(action.force ? 'Push forzado' : 'Push', () => api.pushBranch(repo, action.branch, action.remote, action.remoteBranch, { force: action.force, setUpstream: action.setUpstream }), `${action.branch} subida a ${where}`)
        return
      }
      case 'pr':
        await createPr(action.branch, action.head ? `${prs?.remote ?? 'origin'}/${action.head}` : undefined, action.base)
        return
    }
  }

  const deleteLocalBranch = async (ref: Ref): Promise<void> => {
    if (ref.isHead) return toast('error', 'No puedes eliminar la rama en la que estás')
    if (!(await confirm(`¿Eliminar la rama ${ref.name}?`, 'Eliminar', undefined, true))) return
    const restore = () => api.createBranch(repo, ref.name, ref.hash, false)
    const again = () => api.deleteBranch(repo, ref.name, true)
    try {
      await api.deleteBranch(repo, ref.name, false)
      toast('success', `Rama ${ref.name} eliminada`)
      await remember(`Eliminar rama ${ref.name}`, restore, again)
    } catch (e) {
      if (/not fully merged/i.test(errorText(e))) {
        const force = await confirm(`${ref.name} tiene commits que no están en ninguna otra rama`, 'Eliminar de todos modos', 'Puedes recuperarla con Deshacer mientras no cambies nada más.', true)
        if (force && (await run('Eliminar rama', () => api.deleteBranch(repo, ref.name, true), `Rama ${ref.name} eliminada`))) await remember(`Eliminar rama ${ref.name}`, restore, again)
      } else toast('error', 'No se pudo eliminar la rama', errorText(e))
    } finally {
      void refreshAll()
    }
  }

  // ── Eliminar varias ramas ────────────────────────────────────────────────

  const branchesMenu = async (list: Ref[], title?: string, onSelect?: () => void): Promise<void> => {
    if (!list.length) return
    const n = list.length
    const id = await api.contextMenu([
      { id: 'delete', label: `Eliminar ${n === 1 ? 'la rama' : `las ${n} ramas`}${title ? ` de ${title}` : ''}…` },
      ...(onSelect ? [{ id: 'select', label: `Seleccionar ${n === 1 ? 'la rama' : `las ${n} ramas`}` }] : []),
      { type: 'separator' },
      { id: 'hide', label: 'Ocultar o mostrar en el gráfico' }
    ])
    if (id === 'delete') setBulkDelete(planBulkDelete(list, refs, data.worktrees))
    else if (id === 'select') onSelect?.()
    else if (id === 'hide') toggleHidden(list)
  }

  const runBulkDelete = async (plan: BulkDeletePlan, withTwins: boolean): Promise<void> => {
    const deleted: Ref[] = []
    const failed: string[] = []
    const notMerged: Ref[] = []
    const removeLocals = async (list: Ref[], force: boolean): Promise<void> => {
      for (const ref of list) {
        try {
          await api.deleteBranch(repo, ref.name, force)
          deleted.push(ref)
        } catch (e) {
          if (!force && /not fully merged/i.test(errorText(e))) notMerged.push(ref)
          else failed.push(`${ref.name}: ${errorText(e)}`)
        }
      }
    }
    if (!(await run('Eliminar ramas locales', () => removeLocals(plan.locals, false)))) return
    if (notMerged.length) {
      const shown = notMerged.slice(0, 12).map((r) => r.name).join('\n')
      const force = await confirm(
        `${notMerged.length} ${notMerged.length === 1 ? 'rama tiene' : 'ramas tienen'} commits que no están en ninguna otra rama`,
        'Eliminar de todos modos',
        `${shown}${notMerged.length > 12 ? `\n… y ${notMerged.length - 12} más` : ''}\n\nSe recuperan con Deshacer mientras no cambies nada más. Si no aceptas, se conservan.`,
        true
      )
      if (force) await run('Eliminar ramas locales', () => removeLocals(notMerged, true))
    }
    // La remota de una local se borra solo si la local se eliminó
    const remotes = [...plan.remotes, ...(withTwins ? plan.twins.filter((t) => deleted.includes(t.local)).map((t) => t.remote) : [])]
    const locals = deleted.length
    let remoteCount = 0
    if (remotes.length) {
      await run('Eliminar ramas remotas', async () => {
        for (const ref of remotes) {
          try {
            await api.deleteRemoteBranch(repo, ref.remote!, remoteBranchName(ref))
            remoteCount++
          } catch (e) {
            failed.push(`${ref.name}: ${errorText(e)}`)
          }
        }
      })
    }
    const total = locals + remoteCount
    if (total) toast('success', `${total} ${total === 1 ? 'rama eliminada' : 'ramas eliminadas'}`, locals ? 'Las locales se recuperan con Deshacer.' : undefined)
    if (failed.length) toast('error', `${failed.length} ${failed.length === 1 ? 'rama no se pudo eliminar' : 'ramas no se pudieron eliminar'}`, failed.join('\n'))
    if (locals) {
      const removed = deleted.slice()
      await remember(
        `Eliminar ${locals} ${locals === 1 ? 'rama' : 'ramas'}`,
        async () => { for (const ref of removed) await api.createBranch(repo, ref.name, ref.hash, false) },
        async () => { for (const ref of removed) await api.deleteBranch(repo, ref.name, true) }
      )
    }
    void refreshAll()
  }

  const renameBranch = async (ref: Ref): Promise<void> => {
    const result = await prompt({ title: 'Renombrar rama', initial: ref.name, confirmLabel: 'Renombrar', validate: (v) => (/\s/.test(v) ? 'El nombre no puede tener espacios' : null) })
    if (result && result.value !== ref.name && (await run('Renombrar rama', () => api.renameBranch(repo, ref.name, result.value), `Rama renombrada a ${result.value}`))) {
      await remember(`Renombrar ${ref.name}`, () => api.renameBranch(repo, result.value, ref.name), () => api.renameBranch(repo, ref.name, result.value))
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
      await remember(`Crear etiqueta ${result.value}`, () => api.deleteTag(repo, result.value), () => api.createTag(repo, result.value, hash, result.secondary))
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

  /** Deshacer un commit devuelve sus cambios a preparados y el mensaje a la caja; rehacerlo los vuelve a confirmar. */
  const commitUndo = (before: RepoState, saved: CommitDraft): UndoPlan | null => {
    if (!before.head) return null
    return {
      mode: 'soft',
      undo: async () => (await api.reset(repo, before.head!, 'soft'), setDraft({ ...saved, amend: false })),
      onRedo: () => setDraft(EMPTY_DRAFT)
    }
  }

  const commitMessage = (): string => (draft.body.trim() ? `${draft.summary.trim()}\n\n${draft.body.trim()}` : draft.summary.trim())

  const commit = async (): Promise<void> => {
    if (!draft.summary.trim()) {
      setSummaryFocus((n) => n + 1)
      return
    }
    const saved = draft
    const ok = await runUndoable(draft.amend ? 'Amend' : `Commit "${draft.summary.trim()}"`, () => api.commit(repo, commitMessage(), draft.amend), draft.amend ? 'Commit modificado' : 'Commit creado', (b) => commitUndo(b, saved))
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
    }, 'Commit creado', (b) => commitUndo(b, saved))
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
    // El clic derecho ya selecciona la fila, pero este cierre conserva la selección anterior
    const previous = selection?.kind === 'commit' ? selection.hash : selection?.kind === 'compare' ? selection.target.hash : null
    const items: MenuItemSpec[] = [
      { id: 'checkout', label: 'Checkout de este commit', enabled: commit.hash !== head },
      { id: 'branch', label: 'Crear rama aquí…' },
      { id: 'tag', label: 'Crear etiqueta aquí…' },
      { type: 'separator' },
      { id: 'compare-head', label: `Comparar con ${currentBranch ?? 'HEAD'}`, enabled: !!head && commit.hash !== head },
      ...(previous && previous !== commit.hash ? [{ id: 'compare-selected', label: `Comparar con ${nameOf(previous)} (seleccionado)` }] : []),
      { id: 'rebase-i', label: 'Rebase interactivo desde aquí…', enabled: !!head && !state?.operation && ancestorsOfHead().has(commit.hash) },
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
    else if (id === 'compare-head' && head) startCompare({ hash: commit.hash, label: nameOf(commit.hash) }, { hash: head, label: currentBranch ?? 'HEAD' })
    else if (id === 'compare-selected' && previous) startCompare({ hash: previous, label: nameOf(previous) }, { hash: commit.hash, label: nameOf(commit.hash) })
    else if (id === 'rebase-i') setRebasePlan({ base: commit.hash, mode: 'from' })
    else if (id === 'copy-sha') copy(commit.hash, 'SHA')
    else if (id === 'copy-msg') copy(commit.subject, 'Mensaje')
  }

  const refMenu = async (ref: Ref): Promise<void> => {
    const isCurrent = !!ref.isHead
    const canIntegrate = !!currentBranch && !isCurrent && ref.type !== 'tag'
    // Una rama sincronizada se ve una sola vez: desde ella también se llega a su remota
    const remote = ref.type === 'remote' ? ref : ref.type === 'local' ? remoteTwin(ref, refs) : undefined
    const items: MenuItemSpec[] = [
      { id: 'checkout', label: ref.type === 'remote' ? 'Checkout (crea la rama local)' : ref.type === 'tag' ? 'Checkout (HEAD desacoplado)' : 'Checkout', enabled: !isCurrent },
      { type: 'separator' },
      { id: 'merge', label: `Merge de ${ref.name} en ${currentBranch ?? '…'}`, enabled: canIntegrate },
      { id: 'rebase', label: `Rebase de ${currentBranch ?? '…'} sobre ${ref.name}`, enabled: canIntegrate },
      { type: 'separator' },
      ...(isCurrent ? [{ id: 'push', label: 'Push' }, { id: 'pull', label: 'Pull' }, { type: 'separator' } as MenuItemSpec] : []),
      { id: 'branch', label: 'Crear rama aquí…' },
      { id: 'tag', label: 'Crear etiqueta aquí…', enabled: ref.type !== 'tag' },
      ...(ref.type === 'local' ? [{ id: 'worktree', label: 'Abrir en un worktree nuevo…', enabled: !isCurrent }] : []),
      { type: 'separator' },
      { id: 'compare', label: `Comparar con ${currentBranch ?? 'HEAD'}`, enabled: !isCurrent && !!head && ref.hash !== head },
      ...(prs?.webUrl && ref.type === 'local' ? [{ id: 'pr', label: `Crear ${prWord}…` }] : []),
      { type: 'separator' },
      { id: 'hide', label: isRefHidden(ref) ? 'Mostrar en el gráfico' : 'Ocultar en el gráfico', enabled: !isCurrent },
      { id: 'solo', label: 'Mostrar solo esta rama en el gráfico' },
      ...(filterActive ? [{ id: 'show-all', label: 'Mostrar todas las ramas' }] : []),
      { type: 'separator' },
      ...(ref.type === 'local' ? [{ id: 'rename', label: 'Renombrar…' }, { id: 'delete', label: 'Eliminar…', enabled: !isCurrent }] : []),
      ...(remote ? [{ id: 'delete-remote', label: ref.type === 'remote' ? 'Eliminar rama remota…' : `Eliminar ${remote.name} del remoto…` }] : []),
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
    else if (id === 'worktree') void newWorktree(ref.name)
    else if (id === 'compare' && head) startCompare({ hash: head, label: currentBranch ?? 'HEAD' }, { hash: ref.hash, label: ref.name })
    else if (id === 'pr') void createPr(ref.name, ref.upstream)
    else if (id === 'hide') toggleHidden([ref])
    else if (id === 'solo') setFilter({ hidden: [], solo: withUpstream(ref) })
    else if (id === 'show-all') setFilter(NO_FILTER)
    else if (id === 'rename') void renameBranch(ref)
    else if (id === 'delete') void deleteLocalBranch(ref)
    else if (id === 'delete-remote' && remote) {
      const [remoteName, ...rest] = remote.name.split('/')
      const branch = rest.join('/')
      if (await confirm(`¿Eliminar ${remote.name} del servidor?`, 'Eliminar', `Ejecuta git push ${remoteName} --delete ${branch}. Afecta a todas las personas que usan el remoto.`, true)) {
        void run('Eliminar rama remota', () => api.deleteRemoteBranch(repo, remoteName, branch), `${remote.name} eliminada`)
      }
    } else if (id === 'delete-tag') {
      if (await confirm(`¿Eliminar la etiqueta ${ref.name}?`, 'Eliminar', 'Solo se elimina la etiqueta local.', true)) {
        if (await run('Eliminar etiqueta', () => api.deleteTag(repo, ref.name), `Etiqueta ${ref.name} eliminada`)) await remember(`Eliminar etiqueta ${ref.name}`, () => api.createTag(repo, ref.name, ref.hash, ''), () => api.deleteTag(repo, ref.name))
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
    if (source.kind === 'unstaged' || source.kind === 'staged') {
      items.push(
        { type: 'separator' },
        { id: 'edit', label: 'Editar archivo', enabled: !(source.kind === 'unstaged' && file.status === 'D') },
        { id: 'edit-index', label: 'Editar la versión preparada', enabled: !(source.kind === 'staged' && file.status === 'D') && file.status !== '?' }
      )
    }
    if (source.kind === 'commit') {
      // Un borrado no tiene versión en ese commit: se toma la de antes de borrarlo
      const rev = source.status === 'D' ? source.parent : source.hash
      if (rev) items.push({ type: 'separator' }, { id: 'edit-rev', label: `Editar archivo con la versión de ${shortHash(rev)}…` })
    }
    const committed = source.kind === 'commit' || !['?', 'A'].includes(file.status)
    items.push(
      { type: 'separator' },
      { id: 'history', label: 'Ver historial del archivo', enabled: committed },
      { id: 'blame', label: 'Blame (quién cambió cada línea)', enabled: committed && file.status !== 'D' },
      { type: 'separator' },
      { id: 'copy', label: 'Copiar ruta' }
    )
    const id = await api.contextMenu(items)
    if (id === 'open') openDiff(source)
    else if (id === 'edit') void openEditor(file.path, 'working')
    else if (id === 'edit-index') void openEditor(file.path, 'index')
    else if (id === 'edit-rev' && source.kind === 'commit') {
      const rev = (source.status === 'D' ? source.parent : source.hash)!
      void openEditor(file.path, 'working', undefined, { rev, label: shortHash(rev) })
    }
    else if (id === 'history') openFileTool('history', source)
    else if (id === 'blame') openFileTool('blame', source)
    else if (id === 'stage') void quick('No se pudo preparar', () => api.stage(repo, paths([file])))
    else if (id === 'unstage') void quick('No se pudo quitar', () => api.unstage(repo, paths([file])))
    else if (id === 'discard') void discardFiles([file])
    else if (id === 'ours' || id === 'theirs') void quick('No se pudo resolver', () => api.resolveConflict(repo, file.path, id))
    else if (id === 'copy') copy(file.path, 'Ruta')
  }

  // ── Editor de archivos ───────────────────────────────────────────────────

  const setEditor = (next: EditorRequest | null): void => {
    if (next) openEditors.set(repo, next)
    else openEditors.delete(repo)
    editorDirty.current = false
    setEditorState(next)
  }

  /** Cierra el editor; si hay cambios sin guardar, pregunta antes. false = el usuario prefirió seguir editando */
  const leaveEditor = async (): Promise<boolean> => {
    if (!editor) return true
    if (editorDirty.current) {
      const ok = await api.confirm({
        message: `¿Descartar los cambios sin guardar en ${editor.path}?`,
        detail: editor.target === 'index' ? 'La versión preparada se queda como estaba.' : 'El archivo en disco se queda como estaba.',
        confirmLabel: 'Descartar',
        destructive: true
      })
      if (!ok) return false
      dropEditorDraft(repo, editor)
    }
    setEditor(null)
    return true
  }

  const openEditor = async (path: string, target: EditTarget, patch?: string, from?: { rev: string; label: string }): Promise<void> => {
    if (!(await leaveEditor())) return
    setFileTool(null)
    setEditor({ path, target, patch, rev: from?.rev, revLabel: from?.label, nonce: Date.now() })
  }

  const editorSaved = (target: EditTarget, staged: boolean): void => {
    if (!editor) return
    if (target === 'index') {
      toast('success', `Preparada tu versión de ${editor.path}`, 'El archivo en disco no cambió.')
      // De vuelta al diff, ya con lo preparado
      followStaged.current = { path: editor.path, until: Date.now() + 5000 }
      setEditor(null)
    } else if (editor.rev) {
      toast('success', `${editor.path} guardado con la versión de ${editor.revLabel ?? shortHash(editor.rev)}`, staged ? 'Y quedó preparado.' : 'Está en Sin preparar, como cualquier cambio.')
      // Ya es un cambio normal: al volver a esta pestaña se abre el archivo, no otra vez la versión del commit
      openEditors.set(repo, { ...editor, rev: undefined, revLabel: undefined })
      setSelection({ kind: 'wip' })
    } else if (staged) toast('success', `${editor.path} guardado y preparado`)
    void refreshStatus()
  }

  const openDiff = (source: DiffSource | null): void => {
    void leaveEditor().then((ok) => ok && setDiff(source))
  }

  // ── Selección ────────────────────────────────────────────────────────────

  const openFileTool = (kind: FileTool['kind'], source: DiffSource): void => {
    const rev = source.kind === 'commit' ? (source.status === 'D' ? source.parent : source.hash) : null
    void leaveEditor().then((ok) => ok && setFileTool({ kind, path: source.path, rev }))
  }

  const select = (hash: string, scroll = false, extend = false): void => {
    if (editor) return void leaveEditor().then((ok) => ok && selectNow(hash, scroll, extend))
    selectNow(hash, scroll, extend)
  }

  const selectNow = (hash: string, scroll: boolean, extend: boolean): void => {
    // ⌘/Ctrl+clic sobre otro commit: comparar lo que estaba seleccionado con este
    const anchor = selection?.kind === 'commit' ? selection.hash : selection?.kind === 'compare' ? selection.base.hash : null
    if (extend && anchor && hash !== WIP_HASH && !stashes.some((s) => s.hash === hash)) {
      if (hash === anchor) return void (setDiff(null), setSelection({ kind: 'commit', hash }))
      return startCompare(selection?.kind === 'compare' ? selection.base : { hash: anchor, label: nameOf(anchor) }, { hash, label: nameOf(hash) })
    }
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
    swapCompare: () => selection?.kind === 'compare' && startCompare(selection.target, selection.base),
    closeCompare,
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
    if (cmd && e.shiftKey && key === 'o') return e.preventDefault(), setRepoMenu((open) => !open)
    // Con el desplegable de repos abierto, sus teclas son suyas
    if (repoMenu) return
    // Con el editor abierto solo valen los atajos que no tocan el archivo ni cambian de vista sin preguntar
    if (editor) {
      if (cmd && !e.shiftKey && key === 'p') return e.preventDefault(), setPalette(true)
      if (cmd && !e.shiftKey && key === 'j') return e.preventDefault(), onSettings({ leftVisible: !settings.leftVisible })
      if (cmd && !e.shiftKey && key === 'k') return e.preventDefault(), onSettings({ rightVisible: !settings.rightVisible })
      if (e.key === 'Escape' && !typing) return void leaveEditor()
      return
    }
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
    if (cmd && e.shiftKey && key === 'z' && !typing) return e.preventDefault(), void redoLast()
    if (typing || cmd || e.altKey) return
    if (e.key === 'Escape' && fileTool) return setFileTool(null)
    if (e.key === 'Escape' && diff) return setDiff(null)
    if (e.key === 'Escape' && selection?.kind === 'compare') return closeCompare()
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
      ...(redoStack.length ? [{ id: 'redo', group: 'Repositorio', label: `Rehacer: ${redoStack[redoStack.length - 1].label}`, hint: `⇧${mod}Z`, icon: <Icon.Redo size={14} />, run: () => void redoLast() }] : []),
      ...(filterActive ? [{ id: 'show-all', group: 'Ver', label: 'Mostrar todas las ramas en el gráfico', icon: <Icon.Eye size={14} />, run: () => setFilter(NO_FILTER) }] : []),
      { id: 'branch', group: 'Rama', label: 'Nueva rama…', hint: `${mod}B`, icon: <Icon.Branch size={14} />, run: () => void newBranch() },
      ...(selection?.kind === 'commit' && head && ancestorsOfHead().has(selection.hash) && !state?.operation
        ? [{ id: 'rebase-i', group: 'Rama', label: `Rebase interactivo desde ${shortHash(selection.hash)}…`, icon: <Icon.Rebase size={14} />, run: () => setRebasePlan({ base: selection.hash, mode: 'from' }) }]
        : []),
      ...(selection?.kind === 'commit' && head && selection.hash !== head
        ? [{ id: 'compare-head', group: 'Ver', label: `Comparar ${shortHash(selection.hash)} con ${currentBranch ?? 'HEAD'}`, icon: <Icon.Compare size={14} />, run: () => startCompare({ hash: selection.hash, label: nameOf(selection.hash) }, { hash: head, label: currentBranch ?? 'HEAD' }) }]
        : []),
      { id: 'worktree', group: 'Rama', label: 'Nuevo worktree…', icon: <Icon.Worktree size={14} />, run: () => void newWorktree() },
      ...(prs?.webUrl
        ? [
            { id: 'pr-new', group: 'Repositorio', label: `Crear ${prWord} de ${currentBranch ?? 'la rama actual'}`, icon: <Icon.PullRequest size={14} />, run: () => void createPr() },
            { id: 'pr-list', group: 'Repositorio', label: `Ver ${prWord}s en el navegador`, icon: <Icon.External size={14} />, run: () => openUrl(`${prs.webUrl}${prs.provider === 'gitlab' ? '/-/merge_requests' : '/pulls'}`) }
          ]
        : []),
      ...(data.lfs?.installed
        ? [
            { id: 'lfs-track', group: 'LFS', label: 'Seguir un tipo de archivo con Git LFS…', icon: <Icon.Lfs size={14} />, run: () => void lfsTrack() },
            { id: 'lfs-pull', group: 'LFS', label: 'Descargar archivos de Git LFS', icon: <Icon.Lfs size={14} />, run: lfsPull }
          ]
        : []),
      { id: 'stash', group: 'Stash', label: 'Guardar cambios en el stash…', icon: <Icon.Stash size={14} />, run: () => void stash() },
      ...(stashes[0] ? [{ id: 'pop', group: 'Stash', label: 'Aplicar el último stash (pop)', icon: <Icon.Pop size={14} />, run: () => void stashApply(stashes[0], true) }] : []),
      { id: 'stage-all', group: 'Cambios', label: 'Preparar todo', hint: `⇧${mod}S`, icon: <Icon.Plus size={14} />, run: panelActions.stageAll },
      { id: 'unstage-all', group: 'Cambios', label: 'Quitar todo de preparados', hint: `⇧${mod}U`, icon: <Icon.Minus size={14} />, run: panelActions.unstageAll },
      { id: 'commit', group: 'Cambios', label: 'Escribir mensaje de commit', hint: `⇧${mod}M`, icon: <Icon.Commit size={14} />, run: () => (setSelection({ kind: 'wip' }), setSummaryFocus((n) => n + 1)) },
      { id: 'discard-all', group: 'Cambios', label: 'Descartar todos los cambios…', icon: <Icon.Trash size={14} />, run: () => void discardAll() },
      ...(editor ? [{ id: 'editor-close', group: 'Editor', label: `Cerrar el editor de ${editor.path}`, hint: 'Esc', icon: <Icon.Close size={14} />, run: () => void leaveEditor() }] : []),
      ...(!editor && (diff?.kind === 'unstaged' || diff?.kind === 'staged') && diff.status !== 'D'
        ? [
            { id: 'edit', group: 'Editor', label: `Editar ${diff.path}`, icon: <Icon.Edit size={14} />, run: () => void openEditor(diff.path, 'working') },
            ...(diff.status !== '?' ? [{ id: 'edit-index', group: 'Editor', label: `Editar la versión preparada de ${diff.path}`, icon: <Icon.Edit size={14} />, run: () => void openEditor(diff.path, 'index') }] : [])
          ]
        : []),
      { id: 'search', group: 'Ver', label: 'Buscar commits', hint: `${mod}F`, icon: <Icon.Search size={14} />, run: () => (setDiff(null), setSearchFocus((n) => n + 1)) },
      { id: 'left', group: 'Ver', label: 'Mostrar u ocultar el panel izquierdo', hint: `${mod}J`, icon: <Icon.Panel size={14} />, run: () => onSettings({ leftVisible: !settings.leftVisible }) },
      { id: 'right', group: 'Ver', label: 'Mostrar u ocultar el panel derecho', hint: `${mod}K`, icon: <Icon.PanelRight size={14} />, run: () => onSettings({ rightVisible: !settings.rightVisible }) },
      { id: 'terminal', group: 'Repositorio', label: 'Abrir en Terminal', icon: <Icon.Terminal size={14} />, run: () => void api.openTerminal(repo) },
      { id: 'finder', group: 'Repositorio', label: 'Abrir carpeta', icon: <Icon.Folder size={14} />, run: () => void api.openInFinder(repo) },
      { id: 'copy-path', group: 'Repositorio', label: 'Copiar ruta del repositorio', icon: <Icon.Copy size={14} />, run: () => copy(repo, 'Ruta') },
      { id: 'open', group: 'Pestañas', label: 'Abrir repositorio…', icon: <Icon.Folder size={14} />, run: () => onOpenRepo() },
      { id: 'repos', group: 'Pestañas', label: 'Repositorios recientes…', hint: `⇧${mod}O`, icon: <Icon.Folder size={14} />, run: () => setRepoMenu(true) },
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
        redoLabel={redoStack[redoStack.length - 1]?.label ?? null}
        onRedo={() => void redoLast()}
        repoMenu={
          repoMenu && (
            <RepoSwitcher
              recent={settings.recent}
              openRepos={openRepos}
              current={repo}
              onOpen={(path) => path !== repo && onOpenRepo(path)}
              onRemove={onRemoveRecent}
              onClose={closeRepoMenu}
              onOpenDialog={() => onOpenRepo()}
              onNewTab={onNewTab}
            />
          )
        }
        onRepoMenu={() => setRepoMenu((open) => !open)}
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
                selectionReset={selectionReset}
                onSelectRef={(ref) => select(ref.hash, true)}
                onActivateRef={(ref) => void checkoutRef(ref)}
                onRefMenu={(ref) => void refMenu(ref)}
                onBranchesMenu={(list, title, onSelect) => void branchesMenu(list, title, onSelect)}
                onDeleteBranches={(list) => setBulkDelete(planBulkDelete(list, refs, data.worktrees))}
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
                repo={repo}
                worktrees={data.worktrees}
                onOpenWorktree={(tree) => onOpenRepo(tree.path)}
                onWorktreeMenu={(tree) => void worktreeMenu(tree)}
                onNewWorktree={() => void newWorktree()}
                lfs={data.lfs}
                onLfsTrack={() => void lfsTrack()}
                onLfsPull={lfsPull}
                onLfsPatternMenu={(pattern) => void lfsPatternMenu(pattern)}
                prs={prs}
                prsLoading={prsLoading}
                onRefreshPrs={() => void loadPrs()}
                onCreatePr={() => void createPr()}
                onRefDrop={(source, target) => void dropRef(source, target.kind === 'remote' ? target : { kind: 'label', label: labelForRef(target.ref) })}
                onSelectPr={selectPr}
                onActivatePr={checkoutPr}
                onPrMenu={(pr) => void prMenu(pr)}
                onOpenUrl={openUrl}
              />
            </div>
            <Resizer side="left" onResize={(d) => onSettings({ leftWidth: clamp(leftWidth + d, 180, 480) })} />
          </>
        )}
        <main className="center">
          {editor ? (
            <FileEditor
              repo={repo}
              request={editor}
              version={data.statusVersion}
              onClose={() => void leaveEditor()}
              onSwitch={(target) => void openEditor(editor.path, target)}
              onSaved={editorSaved}
              onDirty={(dirty) => {
                editorDirty.current = dirty
              }}
            />
          ) : fileTool?.kind === 'history' ? (
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
          ) : diff?.kind === 'conflict' ? (
            <MergeEditor
              key={diff.path}
              repo={repo}
              path={diff.path}
              currentBranch={currentBranch}
              onClose={() => setDiff(null)}
              onSaved={() => void refreshStatus()}
              onResolveSide={(side) => void quick('No se pudo resolver', () => api.resolveConflict(repo, diff.path, side))}
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
              onEdit={(target, patch) => void openEditor(diff.path, target, patch)}
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
              compareBase={compareBase}
              highlight={highlight}
              wipSummary={draft.summary}
              filterActive={filterActive}
              onWipSummary={(summary) => setDraft({ ...draft, summary })}
              onClearFilter={() => setFilter(NO_FILTER)}
              columns={settings.columns}
              columnWidths={settings.columnWidths}
              canLoadMore={commits.length >= data.limit}
              scrollTarget={scrollTarget}
              searchFocus={searchFocus}
              onColumnsChange={(columns) => onSettings({ columns })}
              onColumnWidths={(columnWidths) => onSettings({ columnWidths })}
              onSelect={(hash, extend) => select(hash, false, extend)}
              onCommitMenu={(c) => void commitMenu(c)}
              onLabelMenu={labelMenu}
              onLabelActivate={activateLabel}
              onLabelDrop={(source, target) => void dropRef(source, { kind: 'label', label: target })}
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
                onOpenDiff={openDiff}
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
        <span className="sb-item sb-path" title={repo}><Icon.Folder size={12} /> <span className="truncate-start">{ltr(homeRelative(repo))}</span></span>
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
        <span className="sb-item muted">{commits.length.toLocaleString('es')} {commits.length === 1 ? 'commit' : 'commits'}</span>
      </footer>
      {palette && <CommandPalette items={paletteItems()} onClose={() => setPalette(false)} />}
      {bulkDelete && (
        <BulkDeleteDialog
          plan={bulkDelete}
          onClose={(result) => {
            const plan = bulkDelete
            setBulkDelete(null)
            if (!result) return
            setSelectionReset((n) => n + 1)
            void runBulkDelete(plan, result.withTwins)
          }}
        />
      )}
      {rebasePlan && (
        <RebaseDialog
          repo={repo}
          base={rebasePlan.base}
          mode={rebasePlan.mode}
          tip={rebasePlan.tip}
          baseName={rebasePlan.baseName}
          branch={rebasePlan.tip ?? currentBranch}
          onClose={() => setRebasePlan(null)}
          onStart={(steps) => void startRebase(steps)}
        />
      )}
    </div>
  )
}
