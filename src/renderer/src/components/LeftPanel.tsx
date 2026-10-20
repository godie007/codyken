import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GraphFilter, Ref, Remote, StashEntry } from '../../../shared/types'
import { buildTree, type TreeNode } from '../lib/refs'
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
}

type SectionId = 'local' | 'remote' | 'tags' | 'stashes' | 'submodules'

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
            [...remoteGroups.entries()].map(([name, refs]) => {
              const key = `remote/${name}`
              const tree = buildTree(refs.filter((r) => match(r.name)), (r) => r.name.slice(name.length + 1))
              if (q && tree.length === 0) return null
              const host = props.remotes.find((r) => r.name === name)?.host
              const allHidden = refs.length > 0 && refs.every(isHidden)
              return (
                <div key={key}>
                  <div className={`lp-row lp-remote ${allHidden ? 'is-hidden' : ''}`} style={{ paddingLeft: 12 }} onClick={() => toggle(key)}>
                    {isOpen(key) ? <Icon.ChevronDown size={12} /> : <Icon.ChevronRight size={12} />}
                    <span className="remote-avatar">{name[0]?.toUpperCase()}</span>
                    <span className="truncate">{name}</span>
                    {host && <span className="remote-host truncate">{host}</span>}
                    <span className="lp-folder-count">{refs.length}</span>
                    {refs.length > 0 && <EyeButton hidden={allHidden} onClick={() => props.onToggleHidden(refs)} />}
                  </div>
                  {isOpen(key) && (tree.length ? renderTree(tree, 1, key) : <div className="lp-empty" style={{ paddingLeft: 40 }}>Haz fetch para ver sus ramas</div>)}
                </div>
              )
            })
          )
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
  return (
    <div
      className={`lp-row ${refItem.isHead ? 'head' : ''} ${hidden ? 'is-hidden' : ''}`}
      style={{ paddingLeft: 28 + depth * 14 }}
      onClick={() => props.onSelectRef(refItem)}
      onDoubleClick={() => props.onActivateRef(refItem)}
      onContextMenu={(e) => (e.preventDefault(), props.onRefMenu(refItem))}
      onMouseEnter={() => props.onHoverRef(refItem)}
      title={refItem.upstream ? `${refItem.name} → ${refItem.upstream}` : refItem.name}
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
