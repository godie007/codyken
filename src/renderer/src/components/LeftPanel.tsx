import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import type { GraphFilter, LfsInfo, PullRequest, PullRequestInfo, Ref, Remote, StashEntry, Worktree } from '../../../shared/types'
import { relativeTime } from '../lib/format'
import { REF_MIME } from '../lib/drop'
import { buildTree, remoteBranchName, type TreeNode } from '../lib/refs'
import { Icon } from './Icons'

export interface LeftPanelProps {
  refs: Ref[]
  remotes: Remote[]
  stashes: StashEntry[]
  submodules: string[]
  filter: GraphFilter
  selectedStash: number | null
  filterFocus: number
  onSelectRef: (ref: Ref) => void
  onActivateRef: (ref: Ref) => void
  onRefMenu: (ref: Ref) => void
  onHoverRef: (ref: Ref | null) => void
  onToggleHidden: (refs: Ref[]) => void
  onClearFilter: () => void
  onSelectStash: (stash: StashEntry) => void
  onStashMenu: (stash: StashEntry) => void
  onOpenSubmodule: (path: string) => void
  /** Se soltó una rama (referencia completa) sobre otra rama o sobre un remoto */
  onRefDrop: (source: string, target: { kind: 'ref'; ref: Ref } | { kind: 'remote'; remote: string }) => void

  repo: string
  worktrees: Worktree[]
  onOpenWorktree: (tree: Worktree) => void
  onWorktreeMenu: (tree: Worktree) => void
  onNewWorktree: () => void

  lfs: LfsInfo | null
  onLfsTrack: () => void
  onLfsPull: () => void
  onLfsPatternMenu: (pattern: string) => void

  prs: PullRequestInfo | null
  prsLoading: boolean
  onRefreshPrs: () => void
  onCreatePr: () => void
  onSelectPr: (pr: PullRequest) => void
  onActivatePr: (pr: PullRequest) => void
  onPrMenu: (pr: PullRequest) => void
  onOpenUrl: (url: string) => void
}

type SectionId = 'local' | 'remote' | 'prs' | 'tags' | 'stashes' | 'worktrees' | 'lfs' | 'submodules'

/** Zona donde se puede soltar una rama arrastrada; `active` mientras está encima */
function useDropZone(onDrop: (source: string) => void): { active: boolean; handlers: Pick<HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'> } {
  const [active, setActive] = useState(false)
  return {
    active,
    handlers: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes(REF_MIME)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setActive(true)
      },
      onDragLeave: () => setActive(false),
      onDrop: (e) => {
        setActive(false)
        const source = e.dataTransfer.getData(REF_MIME)
        if (!source) return
        e.preventDefault()
        e.stopPropagation()
        onDrop(source)
      }
    }
  }
}

/** Botón pequeño en la cabecera de una sección (no la pliega al pulsarlo) */
function HeaderButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="lp-header-btn"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function LeftPanel(props: LeftPanelProps) {
  const [filter, setFilter] = useState('')
  const filterInput = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['tags']))
  const q = filter.trim().toLowerCase()
  const match = (text: string): boolean => !q || text.toLowerCase().includes(q)

  useEffect(() => {
    if (props.filterFocus) filterInput.current?.focus()
  }, [props.filterFocus])

  const toggle = (key: string): void =>
    setCollapsed((set) => {
      const next = new Set(set)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const isOpen = (key: string): boolean => !!q || !collapsed.has(key)

  const locals = useMemo(() => props.refs.filter((r) => r.type === 'local'), [props.refs])
  const remoteGroups = useMemo(() => {
    const groups = new Map<string, Ref[]>()
    for (const remote of props.remotes) groups.set(remote.name, [])
    for (const ref of props.refs) {
      if (ref.type !== 'remote') continue
      const list = groups.get(ref.remote!) ?? []
      list.push(ref)
      groups.set(ref.remote!, list)
    }
    return groups
  }, [props.refs, props.remotes])
  const tags = useMemo(() => props.refs.filter((r) => r.type === 'tag').reverse(), [props.refs])
  // Rama remota → rama local que la sigue (o que se llama igual)
  const localTwins = useMemo(() => {
    const map = new Map<string, string>()
    for (const remote of props.refs) {
      if (remote.type !== 'remote') continue
      const twin = locals.find((l) => l.upstream === remote.name) ?? locals.find((l) => l.name === remote.name.slice(remote.remote!.length + 1))
      if (twin) map.set(remote.fullName, twin.name)
      // Y al revés: rama local sin seguimiento que tiene una remota con su mismo nombre
      const sameName = locals.find((l) => !l.upstream && l.name === remote.name.slice(remote.remote!.length + 1))
      if (sameName && !map.has(sameName.fullName)) map.set(sameName.fullName, remote.name)
    }
    return map
  }, [props.refs, locals])
  // Remotas en el mismo commit que su rama local: se muestran una sola vez, en Local (con la nube de «al día»)
  const syncedRemotes = useMemo(() => {
    const set = new Set<string>()
    for (const remote of props.refs) {
      if (remote.type !== 'remote') continue
      const twin = locals.find((l) => l.upstream === remote.name) ?? locals.find((l) => !l.upstream && l.name === remoteBranchName(remote))
      if (twin && twin.hash === remote.hash) set.add(remote.fullName)
    }
    return set
  }, [props.refs, locals])
  const [showSynced, setShowSynced] = useState<Set<string>>(new Set())
  const localTree = useMemo(() => buildTree(locals.filter((r) => match(r.name)), (r) => r.name), [locals, q])
  const remoteCount = [...remoteGroups.values()].reduce((n, l) => n + l.length, 0)

  const hidden = new Set(props.filter.hidden)
  const solo = new Set(props.filter.solo)
  const isHidden = (ref: Ref): boolean => (solo.size ? !solo.has(ref.fullName) && !ref.isHead : hidden.has(ref.fullName))
  const filtered = hidden.size > 0 || solo.size > 0

  const section = (id: SectionId, title: string, count: number, icon: ReactNode, children: ReactNode, extra?: ReactNode): ReactNode => (
    <div className="lp-section">
      <div className="lp-section-header" onClick={() => toggle(id)}>
        {isOpen(id) ? <Icon.ChevronDown size={13} /> : <Icon.ChevronRight size={13} />}
        {icon}
        <span className="lp-section-title">{title}</span>
        {extra}
        <span className="lp-count">{count}</span>
      </div>
      {isOpen(id) && <div className="lp-section-body">{children}</div>}
    </div>
  )

  const leaves = (nodes: TreeNode<Ref>[]): Ref[] => nodes.flatMap((n) => (n.item ? [n.item] : leaves(n.children)))

  const renderTree = (nodes: TreeNode<Ref>[], depth: number, keyPrefix: string): ReactNode =>
    nodes.map((node) => {
      if (node.item) return <RefRow key={node.item.fullName} refItem={node.item} label={node.name} depth={depth} hidden={isHidden(node.item)} twin={localTwins.get(node.item.fullName)} props={props} />
      const key = `${keyPrefix}/${node.path}`
      const folderRefs = leaves(node.children)
      const allHidden = folderRefs.every(isHidden)
      return (
        <div key={key}>
          <div className={`lp-row lp-folder ${allHidden ? 'is-hidden' : ''}`} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => toggle(key)}>
            {isOpen(key) ? <Icon.ChevronDown size={12} /> : <Icon.ChevronRight size={12} />}
            <Icon.Folder size={13} />
            <span className="truncate">{node.name}</span>
            <span className="lp-folder-count">{folderRefs.length}</span>
            <EyeButton hidden={allHidden} onClick={() => props.onToggleHidden(folderRefs)} />
          </div>
          {isOpen(key) && renderTree(node.children, depth + 1, keyPrefix)}
        </div>
      )
    })

  return (
    <aside className="left-panel">
      <div className="lp-filter">
        <Icon.Search size={13} />
        <input
          ref={filterInput}
          className="lp-filter-input"
          placeholder="Filtrar ramas, etiquetas…"
          value={filter}
          spellCheck={false}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
      </div>
      {filtered && (
        <div className="lp-filter-banner">
          <Icon.EyeOff size={13} />
          <span>{solo.size ? `Mostrando solo ${solo.size} ${solo.size === 1 ? 'rama' : 'ramas'}` : `${hidden.size} ${hidden.size === 1 ? 'rama oculta' : 'ramas ocultas'}`}</span>
          <button className="link" onClick={props.onClearFilter}>Mostrar todas</button>
        </div>
      )}
      <div className="lp-scroll" onMouseLeave={() => props.onHoverRef(null)}>
        {section('local', 'Local', locals.length, <Icon.Laptop size={14} />,
          localTree.length ? renderTree(localTree, 0, 'local') : <div className="lp-empty">Sin ramas locales</div>
        )}
        {section('remote', 'Remoto', remoteCount, <Icon.Cloud size={14} />,
          remoteGroups.size === 0 ? (
            <div className="lp-empty">Sin remotos. Agrega uno con git remote add.</div>
          ) : (
            [...remoteGroups.entries()].map(([name, refs]) => (
              <RemoteGroup
                key={name}
                name={name}
                refs={refs}
                host={props.remotes.find((r) => r.name === name)?.host}
                query={q}
                match={match}
                synced={syncedRemotes}
                showSynced={showSynced.has(name)}
                onToggleSynced={() =>
                  setShowSynced((set) => {
                    const next = new Set(set)
                    if (next.has(name)) next.delete(name)
                    else next.add(name)
                    return next
                  })
                }
                isOpen={isOpen}
                toggle={toggle}
                isHidden={isHidden}
                renderTree={renderTree}
                props={props}
              />
            ))
          )
        )}
        {props.prs?.provider && section('prs', props.prs.provider === 'gitlab' ? 'Merge requests' : 'Pull requests', props.prs.items.length, <Icon.PullRequest size={14} />,
          <PullRequestList info={props.prs} loading={props.prsLoading} match={match} props={props} />,
          <>
            <HeaderButton title="Actualizar" onClick={props.onRefreshPrs}><Icon.Refresh size={12} className={props.prsLoading ? 'spin' : ''} /></HeaderButton>
            <HeaderButton title={props.prs.provider === 'gitlab' ? 'Crear merge request de la rama actual' : 'Crear pull request de la rama actual'} onClick={props.onCreatePr}><Icon.Plus size={13} /></HeaderButton>
          </>
        )}
        {section('tags', 'Etiquetas', tags.length, <Icon.Tag size={14} />,
          tags.length === 0 ? <div className="lp-empty">Sin etiquetas</div> : tags.filter((t) => match(t.name)).map((t) => <RefRow key={t.fullName} refItem={t} label={t.name} depth={0} hidden={isHidden(t)} props={props} />)
        )}
        {section('stashes', 'Stashes', props.stashes.length, <Icon.Stash size={14} />,
          props.stashes.length === 0 ? (
            <div className="lp-empty">Sin stashes</div>
          ) : (
            props.stashes.filter((s) => match(s.message)).map((s) => (
              <div
                key={s.hash}
                className={`lp-row ${props.selectedStash === s.index ? 'active' : ''}`}
                style={{ paddingLeft: 28 }}
                onClick={() => props.onSelectStash(s)}
                onContextMenu={(e) => (e.preventDefault(), props.onStashMenu(s))}
                title={s.message}
              >
                <Icon.Stash size={13} />
                <span className="truncate">{s.message || `stash@{${s.index}}`}</span>
              </div>
            ))
          )
        )}
        {section('worktrees', 'Worktrees', props.worktrees.length, <Icon.Worktree size={14} />,
          <>
            {props.worktrees.filter((w) => match(w.path) || match(w.branch ?? '')).map((tree) => {
              const name = tree.path.split('/').filter(Boolean).pop() ?? tree.path
              const current = tree.path === props.repo
              return (
                <div
                  key={tree.path}
                  className={`lp-row lp-worktree ${current ? 'head' : ''} ${tree.prunable ? 'is-hidden' : ''}`}
                  style={{ paddingLeft: 28 }}
                  onDoubleClick={() => !current && props.onOpenWorktree(tree)}
                  onContextMenu={(e) => (e.preventDefault(), props.onWorktreeMenu(tree))}
                  title={`${tree.path}${current ? '\nEs el worktree de esta pestaña' : '\nDoble clic para abrirlo en una pestaña'}`}
                >
                  {current ? <Icon.Check size={13} strokeWidth={2.6} className="head-icon" /> : <Icon.Worktree size={13} />}
                  <span className="lp-wt-text">
                    <span className="truncate">{name}</span>
                    <span className="lp-wt-branch truncate">{tree.branch ?? (tree.detached ? `desacoplado en ${tree.head?.slice(0, 7)}` : tree.bare ? 'bare' : '')}</span>
                  </span>
                  <span className="lp-track">
                    {tree.isMain && <span className="lp-tag">principal</span>}
                    {tree.locked && <span className="lp-tag" title="Bloqueado con git worktree lock">bloqueado</span>}
                    {tree.prunable && <span className="lp-tag warn" title="La carpeta ya no existe; se limpia con git worktree prune">no existe</span>}
                  </span>
                </div>
              )
            })}
            {props.worktrees.length <= 1 && <div className="lp-empty">Trabaja en otra rama en paralelo, en otra carpeta, sin stash ni checkout.</div>}
          </>,
          <HeaderButton title="Nuevo worktree…" onClick={props.onNewWorktree}><Icon.Plus size={13} /></HeaderButton>
        )}
        {props.lfs && (props.lfs.installed || props.lfs.patterns.length > 0) &&
          section('lfs', 'Git LFS', props.lfs.patterns.length, <Icon.Lfs size={14} />,
            <LfsSection lfs={props.lfs} match={match} props={props} />,
            props.lfs.installed ? <HeaderButton title="Seguir un tipo de archivo con LFS…" onClick={props.onLfsTrack}><Icon.Plus size={13} /></HeaderButton> : undefined
          )}
        {props.submodules.length > 0 &&
          section('submodules', 'Submódulos', props.submodules.length, <Icon.Module size={14} />,
            props.submodules.filter(match).map((path) => (
              <div key={path} className="lp-row" style={{ paddingLeft: 28 }} onDoubleClick={() => props.onOpenSubmodule(path)} title="Doble clic para abrirlo en una pestaña">
                <Icon.Module size={13} />
                <span className="truncate">{path}</span>
              </div>
            ))
          )}
      </div>
    </aside>
  )
}

function RemoteGroup({ name, refs, host, query, match, synced, showSynced, onToggleSynced, isOpen, toggle, isHidden, renderTree, props }: {
  name: string
  refs: Ref[]
  host?: string
  query: string
  match: (text: string) => boolean
  synced: Set<string>
  showSynced: boolean
  onToggleSynced: () => void
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
  isHidden: (ref: Ref) => boolean
  renderTree: (nodes: TreeNode<Ref>[], depth: number, keyPrefix: string) => ReactNode
  props: LeftPanelProps
}) {
  const key = `remote/${name}`
  const drop = useDropZone((source) => props.onRefDrop(source, { kind: 'remote', remote: name }))
  const matching = refs.filter((r) => match(r.name))
  // Al filtrar se muestran todas las que coinciden, también las que están al día con su local
  const inSync = query ? [] : matching.filter((r) => synced.has(r.fullName))
  const listed = query ? matching : matching.filter((r) => !synced.has(r.fullName))
  const tree = buildTree(listed, (r) => r.name.slice(name.length + 1))
  if (query && tree.length === 0) return null
  const allHidden = refs.length > 0 && refs.every(isHidden)
  return (
    <div>
      <div
        className={`lp-row lp-remote ${allHidden ? 'is-hidden' : ''} ${drop.active ? 'drop-target' : ''}`}
        style={{ paddingLeft: 12 }}
        onClick={() => toggle(key)}
        title={`${name}${host ? ` · ${host}` : ''}\nSuelta aquí una rama local para subirla a ${name}`}
        {...drop.handlers}
      >
        {isOpen(key) ? <Icon.ChevronDown size={12} /> : <Icon.ChevronRight size={12} />}
        <span className="remote-avatar">{name[0]?.toUpperCase()}</span>
        <span className="truncate">{name}</span>
        {host && <span className="remote-host truncate">{host}</span>}
        <span className="lp-folder-count">{refs.length}</span>
        {refs.length > 0 && <EyeButton hidden={allHidden} onClick={() => props.onToggleHidden(refs)} />}
      </div>
      {isOpen(key) && (
        <>
          {tree.length > 0 && renderTree(tree, 1, key)}
          {refs.length === 0 && <div className="lp-empty" style={{ paddingLeft: 40 }}>Haz fetch para ver sus ramas</div>}
          {inSync.length > 0 && (
            <>
              <div className="lp-row lp-synced-toggle" style={{ paddingLeft: 40 }} onClick={onToggleSynced} title="Están en el mismo commit que su rama local: se muestran en Local como una sola rama">
                {showSynced ? <Icon.ChevronDown size={12} /> : <Icon.ChevronRight size={12} />}
                <span className="truncate">
                  {inSync.length === 1 ? `${remoteBranchName(inSync[0])}: igual que la local` : `${inSync.length} iguales a su rama local`}
                </span>
              </div>
              {showSynced && renderTree(buildTree(inSync, (r) => r.name.slice(name.length + 1)), 2, `${key}/synced`)}
            </>
          )}
        </>
      )}
    </div>
  )
}

function EyeButton({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <button
      className={`lp-eye ${hidden ? 'on' : ''}`}
      title={hidden ? 'Mostrar en el gráfico' : 'Ocultar del gráfico'}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {hidden ? <Icon.EyeOff size={13} /> : <Icon.Eye size={13} />}
    </button>
  )
}

function RefRow({ refItem, label, depth, hidden, twin, props }: { refItem: Ref; label: string; depth: number; hidden: boolean; twin?: string; props: LeftPanelProps }) {
  const isLocal = refItem.type === 'local'
  const synced = isLocal && !!refItem.upstream && !refItem.gone && !refItem.ahead && !refItem.behind
  const isBranch = refItem.type !== 'tag'
  const drop = useDropZone((source) => source !== refItem.fullName && props.onRefDrop(source, { kind: 'ref', ref: refItem }))
  return (
    <div
      className={`lp-row ${refItem.isHead ? 'head' : ''} ${hidden ? 'is-hidden' : ''} ${drop.active ? 'drop-target' : ''}`}
      style={{ paddingLeft: 28 + depth * 14 }}
      draggable={isBranch}
      onDragStart={(e) => {
        if (!isBranch) return
        e.dataTransfer.setData(REF_MIME, refItem.fullName)
        e.dataTransfer.effectAllowed = 'move'
      }}
      {...(isBranch ? drop.handlers : {})}
      onClick={() => props.onSelectRef(refItem)}
      onDoubleClick={() => props.onActivateRef(refItem)}
      onContextMenu={(e) => (e.preventDefault(), props.onRefMenu(refItem))}
      onMouseEnter={() => props.onHoverRef(refItem)}
      title={`${refItem.upstream ? `${refItem.name} → ${refItem.upstream}${synced ? ' (al día: es la misma rama en tu equipo y en el remoto)' : ''}` : refItem.name}${isBranch ? '\nArrástrala sobre otra rama o un remoto: merge, rebase, push, pull request' : ''}`}
    >
      {refItem.isHead ? <Icon.Check size={13} strokeWidth={2.6} className="head-icon" /> : refItem.type === 'tag' ? <Icon.Tag size={13} /> : <Icon.Branch size={13} />}
      <span className="truncate">{label}</span>
      {refItem.type === 'local' && (
        <span className="lp-track">
          {!!refItem.ahead && <span className="ahead" title={`${refItem.ahead} commit(s) sin subir`}>↑{refItem.ahead}</span>}
          {!!refItem.behind && <span className="behind" title={`${refItem.behind} commit(s) por bajar`}>↓{refItem.behind}</span>}
          {refItem.gone && <span className="gone" title="La rama remota ya no existe">✕</span>}
          {synced && <span className="lp-synced" title={`Al día con ${refItem.upstream}`}><Icon.Cloud size={12} /></span>}
          {isLocal && !refItem.upstream && twin && <span className="lp-synced untracked" title={`También existe ${twin}, pero esta rama no la sigue`}><Icon.Cloud size={12} /></span>}
          {isLocal && !refItem.upstream && !twin && <span className="lp-local-only" title="Solo existe en tu equipo (nunca se ha subido)">local</span>}
        </span>
      )}
      {twin && !isLocal && (
        <span className="lp-track" title={`Tienes la rama local ${twin}`}>
          <span className="lp-synced"><Icon.Laptop size={12} /></span>
        </span>
      )}
      {!refItem.isHead && <EyeButton hidden={hidden} onClick={() => props.onToggleHidden([refItem])} />}
    </div>
  )
}

function PullRequestList({ info, loading, match, props }: { info: PullRequestInfo; loading: boolean; match: (text: string) => boolean; props: LeftPanelProps }) {
  const cli = info.provider === 'gitlab' ? 'glab' : 'gh'
  const listUrl = info.webUrl ? `${info.webUrl}${info.provider === 'gitlab' ? '/-/merge_requests' : '/pulls'}` : null
  if (info.cliMissing) {
    return (
      <div className="lp-empty lp-pr-help">
        {info.error ? 'La CLI no tiene una sesión válida.' : `Para listarlos aquí instala ${info.provider === 'gitlab' ? 'GitLab CLI' : 'GitHub CLI'} (${cli}).`} Luego ejecuta <code>{cli} auth login</code>.
        {listUrl && <button className="link" onClick={() => props.onOpenUrl(listUrl)}>Verlos en el navegador</button>}
      </div>
    )
  }
  if (info.error) return <div className="lp-empty lp-pr-help" title={info.error}>No se pudieron cargar: {info.error.split('\n')[0]}</div>
  if (!info.items.length) return <div className="lp-empty">{loading ? 'Cargando…' : `No hay ${info.provider === 'gitlab' ? 'merge requests' : 'pull requests'} abiertos`}</div>
  return (
    <div className="lp-pr-list">
      {info.items.filter((pr) => match(pr.title) || match(pr.head) || match(String(pr.number))).map((pr) => (
        <div
          key={pr.number}
          className="lp-row lp-pr"
          style={{ paddingLeft: 28 }}
          onClick={() => props.onSelectPr(pr)}
          onDoubleClick={() => props.onActivatePr(pr)}
          onContextMenu={(e) => (e.preventDefault(), props.onPrMenu(pr))}
          title={`#${pr.number} ${pr.title}\n${pr.head} → ${pr.base} · ${pr.author}\nDoble clic para hacer checkout`}
        >
          <span className="lp-pr-number">#{pr.number}</span>
          <span className="lp-wt-text">
            <span className="truncate">{pr.title}</span>
            <span className="lp-wt-branch truncate">{pr.head} → {pr.base} · {pr.author} · {relativeTime(pr.updatedAt)}</span>
          </span>
          {pr.draft && <span className="lp-tag">borrador</span>}
        </div>
      ))}
    </div>
  )
}

function LfsSection({ lfs, match, props }: { lfs: LfsInfo; match: (text: string) => boolean; props: LeftPanelProps }) {
  const pending = lfs.files.filter((f) => !f.downloaded).length
  return (
    <>
      {!lfs.installed && (
        <div className="lp-empty lp-pr-help">
          Este repo usa Git LFS, pero git-lfs no está instalado: verás punteros en lugar de los archivos. Instálalo (por ejemplo, <code>brew install git-lfs</code>) y ejecuta <code>git lfs install</code>.
        </div>
      )}
      {lfs.patterns.filter((p) => match(p.pattern)).map((p) => (
        <div key={`${p.source}:${p.pattern}`} className="lp-row" style={{ paddingLeft: 28 }} onContextMenu={(e) => (e.preventDefault(), lfs.installed && props.onLfsPatternMenu(p.pattern))} title={`${p.pattern} (en ${p.source})`}>
          <Icon.Lfs size={13} />
          <span className="truncate mono">{p.pattern}</span>
          {p.source !== '.gitattributes' && <span className="lp-wt-branch truncate">{p.source}</span>}
        </div>
      ))}
      {lfs.installed && lfs.patterns.length === 0 && <div className="lp-empty">Ningún tipo de archivo se guarda en LFS. Usa + para añadir uno (p. ej. *.psd).</div>}
      {lfs.installed && lfs.files.length > 0 && (
        <div className="lp-row lp-lfs-files" style={{ paddingLeft: 28 }}>
          <span className="truncate">{lfs.files.length} {lfs.files.length === 1 ? 'archivo' : 'archivos'} en LFS{pending ? ` · ${pending} sin descargar` : ''}</span>
          {pending > 0 && <button className="btn btn-xs" onClick={props.onLfsPull}>Descargar</button>}
        </div>
      )}
    </>
  )
}
