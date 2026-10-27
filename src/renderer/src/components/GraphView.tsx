import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnId, Commit, WorkingStatus } from '../../../shared/types'
import { api, mod } from '../api'
import { formatFullDate, initials, relativeTime, shortHash } from '../lib/format'
import { laneColor, WIP_HASH, type GraphLayout, type GraphRow } from '../lib/graph'
import { REF_MIME } from '../lib/drop'
import { labelFullName, type RefLabel } from '../lib/refs'
import { Icon } from './Icons'
import { Avatar, Resizer } from './ui'

const ROW_H = 34
const LANE_W = 24
const NODE_R = 11
const MAX_VISIBLE_LANES = 8

const COLUMN_LABELS: Record<ColumnId, string> = {
  refs: 'Rama / Etiqueta',
  graph: 'Gráfico',
  message: 'Mensaje del commit',
  author: 'Autor',
  date: 'Fecha',
  sha: 'SHA'
}
const COLUMN_ORDER: ColumnId[] = ['refs', 'graph', 'message', 'author', 'date', 'sha']
/** Ancho por defecto y límites de las columnas redimensionables; el del gráfico depende de los carriles */
const COLUMN_WIDTHS: Record<Exclude<ColumnId, 'message'>, { width: number; min: number; max: number }> = {
  refs: { width: 184, min: 60, max: 640 },
  graph: { width: 0, min: 36, max: 40 * LANE_W + 12 },
  author: { width: 132, min: 60, max: 400 },
  date: { width: 118, min: 60, max: 300 },
  sha: { width: 74, min: 50, max: 240 }
}

export interface GraphViewProps {
  commits: Commit[]
  graph: GraphLayout
  hasWip: boolean
  status: WorkingStatus
  labels: Map<string, RefLabel[]>
  head: string | null
  selected: string | null
  /** Primer extremo de una comparación (se resalta junto al seleccionado) */
  compareBase?: string | null
  highlight: string | null
  columns: ColumnId[]
  columnWidths: Partial<Record<ColumnId, number>>
  canLoadMore: boolean
  scrollTarget: { hash: string; nonce: number } | null
  searchFocus: number
  wipSummary: string
  filterActive: boolean
  onWipSummary: (summary: string) => void
  onColumnsChange: (columns: ColumnId[]) => void
  onColumnWidths: (widths: Partial<Record<ColumnId, number>>) => void
  /** extend: ⌘/Ctrl+clic, para comparar con lo que ya estaba seleccionado */
  onSelect: (hash: string, extend?: boolean) => void
  onCommitMenu: (commit: Commit) => void
  onLabelMenu: (label: RefLabel) => void
  onLabelActivate: (label: RefLabel) => void
  /** Se soltó una rama (referencia completa) sobre una etiqueta de rama, local o remota */
  onLabelDrop: (sourceRef: string, target: RefLabel) => void
  onCommitActivate: (commit: Commit) => void
  onLoadMore: () => void
  onClearFilter: () => void
}

export function GraphView(props: GraphViewProps) {
  const { commits, graph, hasWip, columns, selected } = props
  const scroller = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const [query, setQuery] = useState('')
  const offset = hasWip ? 1 : 0
  const total = commits.length + offset

  const widthOf = (c: Exclude<ColumnId, 'message'>): number =>
    props.columnWidths[c] ?? (c === 'graph' ? Math.min(graph.maxLanes, MAX_VISIBLE_LANES) * LANE_W + 12 : COLUMN_WIDTHS[c].width)
  const graphWidth = widthOf('graph')
  const visible = COLUMN_ORDER.filter((c) => c === 'message' || columns.includes(c))
  const template = visible.map((c) => (c === 'message' ? 'minmax(140px, 1fr)' : `${widthOf(c)}px`)).join(' ')

  const resizeColumn = (c: Exclude<ColumnId, 'message'>, delta: number): void => {
    const { min, max } = COLUMN_WIDTHS[c]
    props.onColumnWidths({ ...props.columnWidths, [c]: Math.round(Math.min(max, Math.max(min, widthOf(c) + delta))) })
  }
  const resetColumn = (c: ColumnId): void => {
    const { [c]: _, ...rest } = props.columnWidths
    props.onColumnWidths(rest)
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const set = new Set<string>()
    for (const c of commits) {
      if (c.subject.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.hash.startsWith(q)) set.add(c.hash)
    }
    return set
  }, [commits, query])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (props.searchFocus) searchInput.current?.focus()
  }, [props.searchFocus])

  const scrollToIndex = (index: number): void => {
    const el = scroller.current
    if (!el || index < 0) return
    const top = index * ROW_H
    if (top < el.scrollTop + ROW_H) el.scrollTop = Math.max(0, top - ROW_H * 3)
    else if (top + ROW_H > el.scrollTop + el.clientHeight - ROW_H) el.scrollTop = top - el.clientHeight + ROW_H * 4
  }

  useEffect(() => {
    if (!props.scrollTarget) return
    const index = props.scrollTarget.hash === WIP_HASH ? 0 : commits.findIndex((c) => c.hash === props.scrollTarget!.hash) + offset
    scrollToIndex(index)
  }, [props.scrollTarget])

  const lastLoadRequest = useRef(0)
  const onScroll = (): void => {
    const el = scroller.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (props.canLoadMore && el.scrollTop + el.clientHeight > el.scrollHeight - ROW_H * 40 && lastLoadRequest.current !== commits.length) {
      lastLoadRequest.current = commits.length
      props.onLoadMore()
    }
  }

  const jumpToMatch = (direction: 1 | -1): void => {
    if (!matches || matches.size === 0) return
    const current = commits.findIndex((c) => c.hash === selected)
    const n = commits.length
    for (let step = 1; step <= n; step++) {
      const index = (((current + step * direction) % n) + n) % n
      if (matches.has(commits[index].hash)) {
        props.onSelect(commits[index].hash)
        scrollToIndex(index + offset)
        return
      }
    }
  }

  const headerMenu = async (): Promise<void> => {
    const id = await api.contextMenu(
      COLUMN_ORDER.filter((c) => c !== 'message').map((c) => ({ id: c, label: COLUMN_LABELS[c], type: 'checkbox', checked: columns.includes(c) }))
    )
    if (!id) return
    const column = id as ColumnId
    props.onColumnsChange(columns.includes(column) ? columns.filter((c) => c !== column) : [...columns, column])
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 10)
  const end = Math.min(total, Math.ceil((scrollTop + height) / ROW_H) + 10)
  const rows = []
  for (let index = start; index < end; index++) {
    const commit = hasWip && index === 0 ? null : commits[index - offset]
    const hash = commit?.hash ?? WIP_HASH
    rows.push(
      <GraphRowView
        key={hash}
        index={index}
        commit={commit}
        row={graph.rows[index]}
        visible={visible}
        template={template}
        graphWidth={graphWidth}
        selected={selected === hash || props.compareBase === hash}
        compareBase={props.compareBase === hash}
        highlighted={props.highlight === hash}
        dimmed={!!matches && (!commit || !matches.has(commit.hash))}
        isHead={!!commit && commit.hash === props.head}
        labels={commit ? props.labels.get(commit.hash) : undefined}
        props={props}
      />
    )
  }

  return (
    <div className="graph">
      <div className="graph-search">
        <Icon.Search size={14} />
        <input
          ref={searchInput}
          className="graph-search-input"
          placeholder={`Buscar commits por mensaje, autor o SHA (${mod}F)`}
          value={query}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') jumpToMatch(e.shiftKey ? -1 : 1)
            if (e.key === 'Escape') {
              setQuery('')
              e.currentTarget.blur()
            }
          }}
        />
        {matches && <span className="graph-search-count">{matches.size} {matches.size === 1 ? 'resultado' : 'resultados'} · Enter para saltar</span>}
        {props.filterActive && (
          <button className="filter-chip" onClick={props.onClearFilter} title="Mostrar todas las ramas">
            <Icon.EyeOff size={12} /> Ramas filtradas <Icon.Close size={11} />
          </button>
        )}
      </div>
      <div className="graph-header" style={{ gridTemplateColumns: template }} onContextMenu={(e) => (e.preventDefault(), void headerMenu())}>
        {visible.map((c) => (
          <div key={c} className={`graph-header-cell col-${c}`} title={c === 'message' ? undefined : `${COLUMN_LABELS[c]} · arrastra el borde para cambiar el ancho, doble clic para restablecerlo`}>
            {COLUMN_LABELS[c]}
            {c !== 'message' && (
              // Las columnas a la derecha del mensaje crecen hacia la izquierda: su borde útil es el izquierdo
              <Resizer
                className={`col-resizer ${c === 'refs' || c === 'graph' ? 'col-resizer-end' : 'col-resizer-start'}`}
                side={c === 'refs' || c === 'graph' ? 'left' : 'right'}
                onResize={(d) => resizeColumn(c, d)}
                onReset={() => resetColumn(c)}
              />
            )}
          </div>
        ))}
        <button className="icon-btn graph-header-gear" title="Elegir columnas" onClick={() => void headerMenu()}>
          <Icon.ChevronDown size={14} />
        </button>
      </div>
      <div className="graph-scroller" ref={scroller} onScroll={onScroll} tabIndex={-1}>
        <div style={{ height: total * ROW_H, position: 'relative' }}>{rows}</div>
        {total === 0 && <div className="empty">Este repositorio todavía no tiene commits.</div>}
      </div>
    </div>
  )
}

interface RowProps {
  index: number
  commit: Commit | null
  row: GraphRow | undefined
  visible: ColumnId[]
  template: string
  graphWidth: number
  selected: boolean
  compareBase: boolean
  highlighted: boolean
  dimmed: boolean
  isHead: boolean
  labels: RefLabel[] | undefined
  props: GraphViewProps
}

function GraphRowView({ index, commit, row, visible, template, graphWidth, selected, compareBase, highlighted, dimmed, isHead, labels, props }: RowProps) {
  const [dropping, setDropping] = useState(false)
  const color = row ? laneColor(row.color) : 'var(--accent)'
  const isWip = !commit
  const hash = commit?.hash ?? WIP_HASH
  // Al soltar sobre la fila (fuera de una etiqueta) el destino es su primera rama, la local si la hay
  const dropTarget = labels?.find((l) => l.kind === 'branch' && l.local) ?? labels?.find((l) => l.kind === 'branch')
  const hasLabels = !!labels?.length

  return (
    <div
      className={`graph-row ${selected ? 'selected' : ''} ${compareBase ? 'compare-base' : ''} ${highlighted ? 'highlighted' : ''} ${dimmed ? 'dimmed' : ''} ${isWip ? 'wip' : ''} ${dropping ? 'drop-target' : ''}`}
      style={{ top: index * ROW_H, height: ROW_H, gridTemplateColumns: template, ['--lane' as string]: color }}
      onClick={(e) => props.onSelect(hash, e.metaKey || e.ctrlKey)}
      onDoubleClick={() => commit && props.onCommitActivate(commit)}
      onContextMenu={(e) => {
        e.preventDefault()
        if (commit) {
          props.onSelect(hash)
          props.onCommitMenu(commit)
        }
      }}
      onDragOver={(e) => {
        if (dropTarget && e.dataTransfer.types.includes(REF_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropping(true)
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false)
        const source = e.dataTransfer.getData(REF_MIME)
        if (source && dropTarget) props.onLabelDrop(source, dropTarget)
      }}
    >
      {visible.map((column) => {
        switch (column) {
          case 'refs':
            return (
              <div key={column} className="cell col-refs">
                {hasLabels && (
                  <>
                    <RefPills labels={labels!} color={color} props={props} />
                    <span className="ref-connector" />
                  </>
                )}
              </div>
            )
          case 'graph':
            return (
              <div key={column} className="cell col-graph">
                {row && <RowGraph row={row} width={graphWidth} commit={commit} isHead={isHead} connector={hasLabels && visible.includes('refs')} />}
              </div>
            )
          case 'message':
            return (
              <div key={column} className="cell col-message" title={commit?.subject}>
                {isWip ? (
                  <WipCell status={props.status} summary={props.wipSummary} onSummary={props.onWipSummary} onFocus={() => props.onSelect(WIP_HASH)} />
                ) : commit!.stash !== undefined ? (
                  <span className="stash-subject"><Icon.Stash size={13} /> {commit!.subject}</span>
                ) : (
                  commit!.subject
                )}
              </div>
            )
          case 'author':
            return (
              <div key={column} className="cell col-author">
                {commit && (
                  <>
                    <Avatar name={commit.author} email={commit.email} size={18} />
                    <span className="truncate">{commit.author}</span>
                  </>
                )}
              </div>
            )
          case 'date':
            return (
              <div key={column} className="cell col-date" title={commit ? formatFullDate(commit.date) : undefined}>
                {commit && relativeTime(commit.date)}
              </div>
            )
          case 'sha':
            return (
              <div key={column} className="cell col-sha mono">
                {commit && shortHash(commit.hash)}
              </div>
            )
        }
      })}
    </div>
  )
}

function WipCell({ status, summary, onSummary, onFocus }: { status: WorkingStatus; summary: string; onSummary: (s: string) => void; onFocus: () => void }) {
  const all = status.unstaged.concat(status.staged)
  const modified = all.filter((f) => f.status === 'M' || f.status === 'R').length
  const added = all.filter((f) => f.status === 'A' || f.status === '?').length
  const deleted = all.filter((f) => f.status === 'D').length
  return (
    <span className="wip-cell">
      <input
        className="wip-input"
        placeholder="// WIP"
        value={summary}
        spellCheck={false}
        onFocus={onFocus}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onSummary(e.target.value)}
      />
      <span className="wip-counts">
        {modified > 0 && <span className="wip-count wip-m" title="Modificados"><Icon.Wrap size={11} />{modified}</span>}
        {added > 0 && <span className="wip-count wip-a" title="Nuevos"><Icon.Plus size={11} />{added}</span>}
        {deleted > 0 && <span className="wip-count wip-d" title="Eliminados"><Icon.Minus size={11} />{deleted}</span>}
        {status.conflicted.length > 0 && <span className="wip-count wip-u" title="En conflicto"><Icon.Warning size={11} />{status.conflicted.length}</span>}
      </span>
    </span>
  )
}

function RefPills({ labels, color, props }: { labels: RefLabel[]; color: string; props: GraphViewProps }) {
  const [first, ...rest] = labels
  return (
    <div className="pills">
      <RefPill label={first} color={color} props={props} />
      {rest.length > 0 && (
        <>
          <span className="pill-more">+{rest.length}</span>
          <div className="pills-pop">
            {labels.map((label) => (
              <RefPill key={label.key} label={label} color={color} props={props} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RefPill({ label, color, props }: { label: RefLabel; color: string; props: GraphViewProps }) {
  const [over, setOver] = useState(false)
  const isBranch = label.kind === 'branch'
  const remoteOnly = !label.local && label.remotes.length > 0
  const remoteNames = label.remotes.map((r) => r.remote).join(', ')
  const title =
    label.kind === 'tag'
      ? `Etiqueta ${label.name}`
      : label.local && label.remotes.length
        ? `${label.name} — local y en ${remoteNames}`
        : remoteOnly
          ? `${label.name} — solo en el remoto`
          : `${label.name} — solo local`
  const slash = remoteOnly ? label.name.indexOf('/') : -1
  return (
    <span
      className={`pill pill-${label.kind} ${label.isHead ? 'pill-head' : ''} ${remoteOnly ? 'pill-remote' : ''} ${over ? 'pill-drop' : ''}`}
      style={{ ['--pill' as string]: color }}
      draggable={isBranch}
      title={`${title}\nDoble clic: checkout${isBranch ? ' · Arrástrala sobre otra rama: merge, rebase, push o pull request' : ''}`}
      onDragStart={(e) => {
        const ref = labelFullName(label)
        if (!ref) return e.preventDefault()
        e.dataTransfer.setData(REF_MIME, ref)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!isBranch || !e.dataTransfer.types.includes(REF_MIME)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const source = e.dataTransfer.getData(REF_MIME)
        if (!isBranch || !source) return
        e.preventDefault()
        e.stopPropagation()
        props.onLabelDrop(source, label)
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        props.onLabelActivate(label)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.onLabelMenu(label)
      }}
    >
      {label.isHead && <Icon.Check size={11} strokeWidth={3} />}
      {label.kind === 'tag' && <Icon.Tag size={11} />}
      <span className="pill-name">
        {slash > 0 ? (
          <>
            <span className="pill-remote-prefix">{label.name.slice(0, slash + 1)}</span>
            {label.name.slice(slash + 1)}
          </>
        ) : (
          label.name
        )}
      </span>
      {label.local && <Icon.Laptop size={12} className="pill-icon" />}
      {label.remotes.length > 0 && <Icon.Cloud size={12} className="pill-icon" />}
    </span>
  )
}

/** Trazo con esquina redondeada: baja en vertical y gira en horizontal hacia el nodo, o al revés. */
function railPath(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 === x2) return `M${x1} ${y1}L${x2} ${y2}`
  const dir = x2 > x1 ? 1 : -1
  const r = Math.min(10, Math.abs(x2 - x1), Math.abs(y2 - y1))
  if (y1 === 0) {
    // Entra desde arriba: vertical en x1, gira y llega horizontal al nodo
    return `M${x1} ${y1}L${x1} ${y2 - r}Q${x1} ${y2} ${x1 + dir * r} ${y2}L${x2} ${y2}`
  }
  // Sale del nodo: horizontal hasta x2, gira y baja
  return `M${x1} ${y1}L${x2 - dir * r} ${y1}Q${x2} ${y1} ${x2} ${y1 + r}L${x2} ${y2}`
}

function RowGraph({ row, width, commit, isHead, connector }: { row: GraphRow; width: number; commit: Commit | null; isHead: boolean; connector: boolean }) {
  const x = (lane: number): number => lane * LANE_W + LANE_W / 2 + 6
  const cy = ROW_H / 2
  const node = x(row.lane)
  const color = laneColor(row.color)
  const isMerge = (commit?.parents.length ?? 0) > 1
  return (
    <svg width={width} height={ROW_H} className="row-graph">
      {connector && <line x1={0} y1={cy} x2={node} y2={cy} stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />}
      {row.segments.map((s, i) => (
        <path
          key={i}
          d={railPath(x(s.x1), s.y1 * ROW_H, x(s.x2), s.y2 * ROW_H)}
          stroke={laneColor(s.color)}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={s.dashed ? '4 4' : undefined}
        />
      ))}
      {!commit ? (
        <circle cx={node} cy={cy} r={NODE_R - 2} fill="var(--bg-graph)" stroke={color} strokeWidth={2} strokeDasharray="4 3" />
      ) : commit.stash !== undefined ? (
        <g>
          <rect x={node - 9} y={cy - 9} width={18} height={18} rx={4} fill="var(--bg-graph)" stroke={color} strokeWidth={1.8} strokeDasharray="3 2" />
          <path d={`M${node - 4.5} ${cy - 2}h9M${node - 4.5} ${cy + 2}h9`} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      ) : isMerge ? (
        <circle cx={node} cy={cy} r={5} fill={color} stroke="var(--bg-graph)" strokeWidth={2} />
      ) : (
        <g>
          {isHead && <circle cx={node} cy={cy} r={NODE_R + 3.5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.7} />}
          <circle cx={node} cy={cy} r={NODE_R} fill={color} />
          <circle cx={node} cy={cy} r={NODE_R - 2.2} fill="var(--node-fill)" />
          <text x={node} y={cy + 3.3} textAnchor="middle" className="node-initials" fill={color}>
            {initials(commit.author)}
          </text>
        </g>
      )}
    </svg>
  )
}
