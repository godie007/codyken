import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CommitDetail, DiffSource, FileChange, RepoState, StashEntry, WorkingStatus } from '../../../shared/types'
import { api, mod } from '../api'
import { formatFullDate, shortHash, splitPath } from '../lib/format'
import { buildTree, type TreeNode } from '../lib/refs'
import { Icon } from './Icons'
import { Avatar, StatusBadge } from './ui'

export type Selection = { kind: 'wip' } | { kind: 'commit'; hash: string } | { kind: 'stash'; index: number; hash: string } | null

export interface CommitDraft {
  summary: string
  body: string
  amend: boolean
}

export interface CommitPanelActions {
  stage: (files: FileChange[]) => void
  unstage: (files: FileChange[]) => void
  discard: (files: FileChange[]) => void
  stageAll: () => void
  unstageAll: () => void
  discardAll: () => void
  commit: () => void
  stageAllAndCommit: () => void
  toggleAmend: (amend: boolean) => void
  abortOperation: () => void
  continueOperation: () => void
  stashApply: (stash: StashEntry, pop: boolean) => void
  stashDrop: (stash: StashEntry) => void
  copy: (text: string, what: string) => void
  fileMenu: (file: FileChange, source: DiffSource) => void
}

export interface CommitPanelProps {
  repo: string
  selection: Selection
  status: WorkingStatus
  state: RepoState | null
  stashes: StashEntry[]
  activeDiff: DiffSource | null
  draft: CommitDraft
  version: number
  onDraft: (draft: CommitDraft) => void
  onOpenDiff: (source: DiffSource) => void
  onSelectCommit: (hash: string) => void
  actions: CommitPanelActions
  summaryFocus: number
  fileView: 'list' | 'tree'
  onFileView: (view: 'list' | 'tree') => void
}

export function CommitPanel(props: CommitPanelProps) {
  const { selection } = props
  if (!selection) return <aside className="right-panel"><div className="empty">Selecciona un commit</div></aside>
  if (selection.kind === 'wip') return <WipPanel {...props} />
  return <CommitDetailPanel {...props} hash={selection.hash} stash={selection.kind === 'stash' ? props.stashes.find((s) => s.index === selection.index) : undefined} />
}

// ── Cambios sin confirmar ───────────────────────────────────────────────────

const OPERATION_LABEL = { merge: 'Merge en curso', rebase: 'Rebase en curso', 'cherry-pick': 'Cherry-pick en curso', revert: 'Revert en curso' }

function WipPanel(props: CommitPanelProps) {
  const { status, state, draft, actions } = props
  const summaryRef = useRef<HTMLInputElement>(null)
  const total = status.staged.length + status.unstaged.length + status.conflicted.length
  const canCommit = (status.staged.length > 0 || draft.amend) && !!draft.summary.trim() && status.conflicted.length === 0
  const isActive = (kind: DiffSource['kind'], path: string): boolean => props.activeDiff?.kind === kind && props.activeDiff.path === path

  useEffect(() => {
    if (props.summaryFocus) summaryRef.current?.focus()
  }, [props.summaryFocus])

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) actions.stageAllAndCommit()
      else if (canCommit) actions.commit()
    }
  }

  return (
    <aside className="right-panel">
      <div className="rp-header">
        <div className="rp-title">
          {total} {total === 1 ? 'archivo cambiado' : 'archivos cambiados'}
          {state?.branch && <> en <span className="branch-chip"><Icon.Branch size={12} />{state.branch}</span></>}
        </div>
        <ViewToggle view={props.fileView} onChange={props.onFileView} />
        <button className="icon-btn danger" title="Descartar todos los cambios" disabled={total === 0} onClick={actions.discardAll}>
          <Icon.Trash size={15} />
        </button>
      </div>
      {status.unstaged.length > 0 && (
        <button className="stage-all-bar" onClick={actions.stageAll} title={`⇧${mod}S`}>
          <Icon.Plus size={14} /> Preparar todos los cambios
        </button>
      )}

      {state?.operation && (
        <div className="op-banner">
          <Icon.Warning size={15} />
          <div className="op-banner-text">
            <strong>{OPERATION_LABEL[state.operation]}</strong>
            <span>{status.conflicted.length ? `Resuelve ${status.conflicted.length} conflicto(s) y prepáralos.` : 'Sin conflictos pendientes.'}</span>
          </div>
          <button className="btn btn-sm" onClick={actions.abortOperation}>Abortar</button>
          <button className="btn btn-sm btn-primary" disabled={status.conflicted.length > 0} onClick={actions.continueOperation}>Continuar</button>
        </div>
      )}

      <div className="rp-scroll">
        {status.conflicted.length > 0 && (
          <FileSection title="En conflicto" count={status.conflicted.length} tone="danger">
            {status.conflicted.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                active={isActive('conflict', f.path)}
                onClick={() => props.onOpenDiff({ kind: 'conflict', path: f.path })}
                onContextMenu={() => actions.fileMenu(f, { kind: 'conflict', path: f.path })}
                actions={<button className="btn btn-xs" onClick={() => actions.stage([f])}>Marcar resuelto</button>}
              />
            ))}
          </FileSection>
        )}

        <FileSection
          title="Sin preparar"
          count={status.unstaged.length}
          action={status.unstaged.length > 0 && <button className="btn btn-xs" onClick={actions.stageAll}>Preparar todo</button>}
        >
          {status.unstaged.length === 0 && <div className="rp-empty">No hay cambios sin preparar</div>}
          <FileList
            files={status.unstaged}
            view={props.fileView}
            sourceOf={(f) => ({ kind: 'unstaged', path: f.path, status: f.status })}
            isActive={(f) => isActive('unstaged', f.path)}
            onOpen={props.onOpenDiff}
            onMenu={actions.fileMenu}
            fileActions={(f) => (
              <>
                <button className="icon-btn danger" title="Descartar cambios" onClick={() => actions.discard([f])}><Icon.Trash size={13} /></button>
                <button className="btn btn-xs btn-stage" onClick={() => actions.stage([f])}>Preparar</button>
              </>
            )}
            folderActions={(files) => <button className="btn btn-xs btn-stage" onClick={() => actions.stage(files)}>Preparar carpeta</button>}
          />
        </FileSection>

        <FileSection
          title="Preparados"
          count={status.staged.length}
          tone="ok"
          action={status.staged.length > 0 && <button className="btn btn-xs" onClick={actions.unstageAll}>Quitar todo</button>}
        >
          {status.staged.length === 0 && <div className="rp-empty">Prepara archivos para incluirlos en el commit</div>}
          <FileList
            files={status.staged}
            view={props.fileView}
            sourceOf={(f) => ({ kind: 'staged', path: f.path, oldPath: f.oldPath, status: f.status })}
            isActive={(f) => isActive('staged', f.path)}
            onOpen={props.onOpenDiff}
            onMenu={actions.fileMenu}
            fileActions={(f) => <button className="btn btn-xs" onClick={() => actions.unstage([f])}>Quitar</button>}
            folderActions={(files) => <button className="btn btn-xs" onClick={() => actions.unstage(files)}>Quitar carpeta</button>}
          />
        </FileSection>
      </div>

      <div className="commit-box" onKeyDown={onKey}>
        <div className="commit-summary-row">
          <input
            ref={summaryRef}
            className="input commit-summary"
            placeholder="Resumen del commit"
            value={draft.summary}
            onChange={(e) => props.onDraft({ ...draft, summary: e.target.value })}
          />
          <span className={`char-count ${draft.summary.length > 72 ? 'over' : draft.summary.length > 50 ? 'warn' : ''}`}>{72 - draft.summary.length}</span>
        </div>
        <textarea
          className="input commit-body"
          placeholder="Descripción (opcional)"
          rows={4}
          value={draft.body}
          onChange={(e) => props.onDraft({ ...draft, body: e.target.value })}
        />
        <label className="checkbox">
          <input type="checkbox" checked={draft.amend} disabled={!state?.head} onChange={(e) => actions.toggleAmend(e.target.checked)} />
          Modificar el último commit (amend)
        </label>
        <button className="btn btn-commit btn-block" disabled={!canCommit} onClick={actions.commit} title={`${mod}Enter`}>
          {draft.amend ? 'Modificar el último commit' : status.staged.length ? `Hacer commit de ${status.staged.length} ${status.staged.length === 1 ? 'archivo' : 'archivos'}` : 'Prepara cambios para hacer commit'}
        </button>
      </div>
    </aside>
  )
}

function FileSection({ title, count, tone, action, children }: { title: string; count: number; tone?: 'ok' | 'danger'; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="file-section">
      <div className={`file-section-header ${tone ?? ''}`}>
        <span>{title}</span>
        <span className="lp-count">{count}</span>
        <span className="spacer" />
        {action}
      </div>
      {children}
    </section>
  )
}

function ViewToggle({ view, onChange }: { view: 'list' | 'tree'; onChange: (view: 'list' | 'tree') => void }) {
  return (
    <div className="segmented segmented-icons" onClick={(e) => e.stopPropagation()}>
      <button className={view === 'list' ? 'active' : ''} title="Ver como lista de rutas" onClick={() => onChange('list')}><Icon.List size={13} /></button>
      <button className={view === 'tree' ? 'active' : ''} title="Ver como árbol de carpetas" onClick={() => onChange('tree')}><Icon.Tree size={13} /></button>
    </div>
  )
}

interface FileListProps {
  files: FileChange[]
  view: 'list' | 'tree'
  sourceOf: (file: FileChange) => DiffSource
  isActive: (file: FileChange) => boolean
  onOpen: (source: DiffSource) => void
  onMenu: (file: FileChange, source: DiffSource) => void
  fileActions?: (file: FileChange) => ReactNode
  folderActions?: (files: FileChange[]) => ReactNode
}

function FileList(props: FileListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const row = (f: FileChange, depth: number, label?: string): ReactNode => {
    const source = props.sourceOf(f)
    return (
      <FileRow
        key={f.path}
        file={f}
        depth={depth}
        label={label}
        active={props.isActive(f)}
        onClick={() => props.onOpen(source)}
        onContextMenu={() => props.onMenu(f, source)}
        actions={props.fileActions?.(f)}
      />
    )
  }
  if (props.view === 'list') return <>{props.files.map((f) => row(f, 0))}</>

  const leaves = (nodes: TreeNode<FileChange>[]): FileChange[] => nodes.flatMap((n) => (n.item ? [n.item] : leaves(n.children)))
  const render = (nodes: TreeNode<FileChange>[], depth: number): ReactNode =>
    nodes.map((node) => {
      if (node.item) return row(node.item, depth, node.name)
      const open = !collapsed.has(node.path)
      const files = leaves(node.children)
      return (
        <div key={`dir:${node.path}`}>
          <div
            className="file-row folder-row"
            style={{ paddingLeft: 12 + depth * 14 }}
            onClick={() =>
              setCollapsed((set) => {
                const next = new Set(set)
                if (open) next.add(node.path)
                else next.delete(node.path)
                return next
              })
            }
          >
            {open ? <Icon.ChevronDown size={12} /> : <Icon.ChevronRight size={12} />}
            <Icon.Folder size={13} />
            <span className="file-name truncate">{node.name}</span>
            <span className="lp-folder-count">{files.length}</span>
            {props.folderActions && <span className="file-actions" onClick={(e) => e.stopPropagation()}>{props.folderActions(files)}</span>}
          </div>
          {open && render(node.children, depth + 1)}
        </div>
      )
    })
  return <>{render(buildTree(props.files, (f) => f.path), 0)}</>
}

function FileRow({ file, active, onClick, onContextMenu, actions, depth = 0, label }: { file: FileChange; active: boolean; onClick: () => void; onContextMenu: () => void; actions?: ReactNode; depth?: number; label?: string }) {
  const { dir, name } = splitPath(file.path)
  return (
    <div
      className={`file-row ${active ? 'active' : ''}`}
      style={depth ? { paddingLeft: 30 + (depth - 1) * 14 } : undefined}
      onClick={onClick}
      onContextMenu={(e) => (e.preventDefault(), onContextMenu())}
      title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
    >
      <StatusBadge status={file.status} />
      <span className="file-name truncate">
        <span className="file-base">{label ?? name}</span>
        {!label && dir && <span className="file-dir">{dir}</span>}
      </span>
      {actions && (
        <span className="file-actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </span>
      )}
    </div>
  )
}

// ── Detalle de un commit o stash ────────────────────────────────────────────

const detailCache = new Map<string, CommitDetail>()

function CommitDetailPanel(props: CommitPanelProps & { hash: string; stash?: StashEntry }) {
  const { repo, hash, stash, actions } = props
  const [detail, setDetail] = useState<CommitDetail | null>(detailCache.get(`${repo}:${hash}`) ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const key = `${repo}:${hash}`
    setError(null)
    setDetail(detailCache.get(key) ?? null)
    api.getCommitDetail(repo, hash).then(
      (d) => {
        detailCache.set(key, d)
        if (alive) setDetail(d)
      },
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [repo, hash])

  if (error) return <aside className="right-panel"><div className="empty">{error}</div></aside>
  if (!detail) return <aside className="right-panel"><div className="empty">Cargando…</div></aside>

  const [summary, ...rest] = detail.message.split('\n')
  const body = rest.join('\n').trim()
  const parent = detail.parents[0] ?? null
  const isActive = (path: string): boolean => props.activeDiff?.kind === 'commit' && props.activeDiff.hash === detail.hash && props.activeDiff.path === path

  return (
    <aside className="right-panel">
      <div className="rp-header">
        <div className="rp-title">
          {stash ? <><Icon.Stash size={14} /> Stash</> : <><Icon.Commit size={14} /> Commit</>}
          <button className="sha-chip mono" title="Copiar SHA completo" onClick={() => actions.copy(detail.hash, 'SHA')}>
            {shortHash(detail.hash)} <Icon.Copy size={11} />
          </button>
        </div>
      </div>
      {stash && (
        <div className="stash-actions">
          <button className="btn btn-sm btn-primary" onClick={() => actions.stashApply(stash, true)}>Aplicar y eliminar (pop)</button>
          <button className="btn btn-sm" onClick={() => actions.stashApply(stash, false)}>Aplicar</button>
          <button className="btn btn-sm danger" onClick={() => actions.stashDrop(stash)}>Eliminar</button>
        </div>
      )}
      <div className="rp-scroll">
        <div className="commit-info">
          <h2 className="commit-subject">{summary}</h2>
          {body && <pre className="commit-body-text">{body}</pre>}
          <div className="commit-meta">
            <Avatar name={detail.author} email={detail.email} size={30} />
            <div>
              <div className="commit-author">{detail.author} <span className="muted">&lt;{detail.email}&gt;</span></div>
              <div className="muted small">{formatFullDate(detail.date)}</div>
              {(detail.committer !== detail.author || detail.committerEmail !== detail.email) && (
                <div className="muted small">Confirmado por {detail.committer} · {formatFullDate(detail.committerDate)}</div>
              )}
            </div>
          </div>
          {detail.parents.length > 0 && (
            <div className="commit-parents small">
              <span className="muted">{detail.parents.length > 1 ? 'Padres:' : 'Padre:'}</span>
              {detail.parents.map((p) => (
                <button key={p} className="link mono" onClick={() => props.onSelectCommit(p)}>{shortHash(p)}</button>
              ))}
            </div>
          )}
        </div>
        <FileSection title="Archivos" count={detail.files.length} action={<ViewToggle view={props.fileView} onChange={props.onFileView} />}>
          <FileList
            files={detail.files}
            view={props.fileView}
            sourceOf={(f) => (f.commit ? { kind: 'commit', hash: f.commit, parent: null, path: f.path, status: 'A' } : { kind: 'commit', hash: detail.hash, parent, path: f.path, oldPath: f.oldPath, status: f.status })}
            isActive={(f) => isActive(f.path)}
            onOpen={props.onOpenDiff}
            onMenu={actions.fileMenu}
          />
        </FileSection>
      </div>
    </aside>
  )
}
