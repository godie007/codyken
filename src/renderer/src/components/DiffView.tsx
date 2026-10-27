import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { DiffMode, DiffSource, EditTarget } from '../../../shared/types'
import { api } from '../api'
import { intraline, pairChangedLines, parseDiff, toSplitRows, type DiffLine, type Hunk } from '../lib/diff'
import { shortHash, splitPath } from '../lib/format'
import { highlightCode, languageFor } from '../lib/highlight'
import { buildPatch, supportsPartialStaging, type HunkPick } from '../lib/patch'
import { Icon } from './Icons'
import { StatusBadge, useToast } from './ui'

const LINE_LIMIT = 6000
const HINT_KEY = 'codyken.diffHintHidden'

/** Preferencias de este equipo que no hace falta sincronizar: si el almacenamiento falla, se muestran como la primera vez */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // sin almacenamiento: el consejo vuelve a salir la próxima vez
  }
}

export interface DiffViewProps {
  repo: string
  source: DiffSource
  mode: DiffMode
  wrap: boolean
  version: number
  onModeChange: (mode: DiffMode) => void
  onWrapChange: (wrap: boolean) => void
  onClose: () => void
  onChanged: () => void
  onStageFile: () => void
  onUnstageFile: () => void
  onDiscardFile: () => void
  onResolveConflict: (side: 'ours' | 'theirs') => void
  onHistory: () => void
  onBlame: () => void
  /** Abrir el editor: el archivo de trabajo, o la versión preparada (con `patch`, más esas líneas) */
  onEdit?: (target: EditTarget, patch?: string) => void
  embedded?: boolean
}

type HunkAction = 'stage' | 'unstage' | 'discard'
/** Líneas elegidas por bloque (índice del hunk → índices de sus líneas) */
type LineSelection = Map<number, Set<number>>
const NONE: LineSelection = new Map()

export function DiffView(props: DiffViewProps) {
  const { repo, source, mode, wrap, version } = props
  const { toast } = useToast()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<LineSelection>(NONE)
  const [showAll, setShowAll] = useState(false)
  const anchor = useRef<{ hunk: number; line: number } | null>(null)
  const [hintHidden, setHintHidden] = useState(() => readFlag(HINT_KEY))
  const hideHint = (): void => {
    setHintHidden(true)
    writeFlag(HINT_KEY)
  }
  const sourceKey = JSON.stringify(source)
  // Archivo y Dividido muestran el archivo entero, como GitKraken
  const full = mode === 'file' || mode === 'split'

  useEffect(() => {
    let alive = true
    setError(null)
    api.getDiff(repo, source, full).then(
      (t) => alive && setText(t),
      (e: Error) => {
        if (!alive) return
        setText(null)
        setError(e.message)
      }
    )
    return () => {
      alive = false
    }
  }, [repo, sourceKey, full, version])

  useEffect(() => {
    setSelection(NONE)
    setShowAll(false)
  }, [sourceKey, version, mode])

  const file = useMemo(() => (text !== null && source.kind !== 'conflict' ? parseDiff(text)[0] ?? null : null), [text, source.kind])
  const partial = !!file && supportsPartialStaging(file)
  const hunkActions: HunkAction[] =
    source.kind === 'unstaged' && partial ? ['discard', 'stage'] : source.kind === 'staged' && partial ? ['unstage'] : []
  const selectable = hunkActions.length > 0
  const selectedCount = useMemo(() => [...selection.values()].reduce((n, lines) => n + lines.size, 0), [selection])
  const editable = !!props.onEdit && (source.kind === 'unstaged' || source.kind === 'staged') && source.status !== 'D' && !file?.binary
  const lang = useMemo(() => languageFor(source.path), [source.path])

  /** Un bloque (con sus líneas elegidas, o entero si no hay) o todas las líneas elegidas en cualquier bloque */
  const picksFor = (target: number | 'selection' | HunkPick[]): HunkPick[] =>
    Array.isArray(target)
      ? target
      : target === 'selection'
        ? [...selection].map(([hunk, lines]) => ({ hunk, lines }))
        : [{ hunk: target, lines: selection.get(target) ?? null }]

  /** Mientras se aplica un parche, el diff aún es el de antes: un segundo clic usaría números de línea viejos */
  const applying = useRef(false)

  const apply = async (target: number | 'selection' | HunkPick[], action: HunkAction): Promise<void> => {
    if (!file || applying.current) return
    const picks = picksFor(target)
    const patch = buildPatch(file, picks, action !== 'stage')
    if (!patch) return
    if (action === 'discard') {
      const lines = picks.reduce((n, p) => n + (p.lines?.size ?? 0), 0)
      const ok = await api.confirm({
        message: lines ? `¿Descartar ${lines === 1 ? 'la línea seleccionada' : `las ${lines} líneas seleccionadas`}?` : '¿Descartar este bloque de cambios?',
        detail: 'Los cambios se pierden del archivo de trabajo y no se pueden recuperar.',
        confirmLabel: 'Descartar',
        destructive: true
      })
      if (!ok) return
    }
    applying.current = true
    try {
      await api.applyPatch(repo, patch, action !== 'discard', action !== 'stage')
      setSelection(NONE)
      props.onChanged()
    } catch (e) {
      toast('error', 'No se pudo aplicar el cambio', e instanceof Error ? e.message : String(e))
    } finally {
      applying.current = false
    }
  }

  /** Botón + / − junto al número de cada línea cambiada: prepara o quita esa línea (o toda la selección, si es parte de ella) */
  const lineAction: LineActionKind | null = hunkActions.includes('stage') ? 'stage' : hunkActions.includes('unstage') ? 'unstage' : null
  const lineActionFor = (hunk: number): LineAction | null =>
    lineAction && {
      kind: lineAction,
      run: (line) => {
        const inSelection = !!selection.get(hunk)?.has(line)
        void apply(inSelection ? 'selection' : [{ hunk, lines: new Set([line]) }], lineAction)
      },
      title: (line) => {
        const many = selection.get(hunk)?.has(line) && selectedCount > 1
        if (lineAction === 'stage') return many ? `Preparar las ${selectedCount} líneas seleccionadas` : 'Preparar esta línea'
        return many ? `Quitar de lo preparado las ${selectedCount} líneas seleccionadas` : 'Quitar esta línea de lo preparado (vuelve a Sin preparar)'
      }
    }

  /** La versión preparada más el bloque (o las líneas elegidas) para retocarla antes de prepararla */
  const editStaged = (target: number | 'selection'): void => {
    if (!file || !props.onEdit) return
    const patch = buildPatch(file, picksFor(target), false)
    if (patch) props.onEdit('index', patch)
  }

  const toggleLine = (hunk: number, line: number, shift: boolean): void => {
    setSelection((current) => {
      const next = new Map(current)
      const lines = new Set(next.get(hunk) ?? [])
      if (shift && anchor.current?.hunk === hunk) {
        const [a, b] = [anchor.current.line, line].sort((x, y) => x - y)
        const changeLines = file!.hunks[hunk].lines
        for (let i = a; i <= b; i++) if (changeLines[i].type === '+' || changeLines[i].type === '-') lines.add(i)
      } else if (lines.has(line)) lines.delete(line)
      else lines.add(line)
      anchor.current = { hunk, line }
      if (lines.size) next.set(hunk, lines)
      else next.delete(hunk)
      return next
    })
  }

  // Con líneas elegidas, S / U las preparan o quitan (en vez del archivo entero) y Esc las deselecciona
  const selectionKeys = useRef<(e: KeyboardEvent) => void>(() => {})
  selectionKeys.current = (e: KeyboardEvent) => {
    if (!selectedCount || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal-backdrop')) return
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
    const key = e.key.toLowerCase()
    if (e.key === 'Escape') setSelection(NONE)
    else if (key === 's' && source.kind === 'unstaged') void apply('selection', 'stage')
    else if (key === 'u' && source.kind === 'staged') void apply('selection', 'unstage')
    else return
    e.preventDefault()
    e.stopPropagation()
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent): void => selectionKeys.current(e)
    // En captura: llega antes que los atajos de la ventana (que prepararían el archivo entero o cerrarían el diff)
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [])

  const label =
    source.kind === 'unstaged' ? 'Sin preparar' : source.kind === 'staged' ? 'Preparado' : source.kind === 'conflict' ? 'En conflicto' : source.label ?? `Commit ${shortHash(source.hash)}`
  const status = source.kind === 'conflict' ? 'U' : source.status

  let body: ReactNode
  if (error) body = <div className="empty">{error}</div>
  else if (text === null) body = <div className="empty">Cargando…</div>
  else if (source.kind === 'conflict') body = <ConflictText text={text} />
  else if (!file || (file.hunks.length === 0 && !file.binary)) body = <div className="empty">{file?.combined ? 'Diff combinado: resuélvelo desde la lista de conflictos.' : 'Sin cambios de contenido en este archivo.'}</div>
  else if (file.binary) body = <div className="empty">Archivo binario: no se puede mostrar el contenido.</div>
  else {
    let budget = showAll ? Infinity : LINE_LIMIT
    const hunks: ReactNode[] = []
    let truncated = false
    file.hunks.forEach((hunk, hi) => {
      if (budget <= 0) {
        truncated = true
        return
      }
      budget -= hunk.lines.length
      const selectedHere = selection.get(hi) ?? null
      hunks.push(
        <div className="hunk" key={hi}>
          {!full || hunkActions.length > 0 ? (
            <div className="hunk-header">
              <span className="mono hunk-range">{full ? 'Archivo completo' : hunk.header}</span>
              <span className="spacer" />
              {hunkActions.map((action) => (
                <HunkButton key={action} action={action} count={selectedHere?.size ?? 0} onClick={() => void apply(hi, action)} />
              ))}
              {hunkActions.includes('stage') && props.onEdit && (
                <button className="btn btn-xs" onClick={() => editStaged(hi)} title="Abre la versión preparada con estos cambios para ajustarlos antes de prepararlos">
                  <Icon.Edit size={11} /> Editar y preparar…
                </button>
              )}
            </div>
          ) : null}
          {mode === 'split' ? (
            <SplitHunk hunk={hunk} lang={lang} wrap={wrap} selected={selectedHere} selectable={selectable} onToggle={(line, shift) => toggleLine(hi, line, shift)} lineAction={lineActionFor(hi)} />
          ) : (
            <UnifiedHunk hunk={hunk} lang={lang} selected={selectedHere} selectable={selectable} onToggle={(line, shift) => toggleLine(hi, line, shift)} lineAction={lineActionFor(hi)} />
          )}
        </div>
      )
    })
    body = (
      <>
        {hunks}
        {truncated && (
          <div className="diff-truncated">
            El diff es muy largo; se muestran las primeras {LINE_LIMIT.toLocaleString('es')} líneas.
            <button className="btn btn-sm" onClick={() => setShowAll(true)}>Mostrar todo</button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <StatusBadge status={status} />
        <span className="diff-path" title={source.path}>
          {/* Como en la lista de archivos: el nombre siempre se ve y la carpeta, detrás, se recorta */}
          <span className="diff-path-name">{splitPath(source.path).name}</span>
          {splitPath(source.path).dir && <span className="diff-path-dir">/{splitPath(source.path).dir.slice(0, -1)}</span>}
        </span>
        <span className="diff-source truncate" title={label}>{label}</span>
        <span className="spacer" />
        {/* Grupos que, en un panel angosto, bajan juntos a su propia fila */}
        {source.kind === 'conflict' ? (
          <div className="diff-tool-group">
            <button className="btn btn-sm" onClick={() => props.onResolveConflict('ours')} title="git checkout --ours">Usar versión HEAD</button>
            <button className="btn btn-sm" onClick={() => props.onResolveConflict('theirs')} title="git checkout --theirs">Usar versión entrante</button>
            <button className="btn btn-sm btn-primary" onClick={props.onStageFile}>Marcar resuelto</button>
          </div>
        ) : (
          <>
            <div className="diff-tool-group">
              {source.kind === 'unstaged' && (
                <>
                  <button className="btn btn-sm danger" onClick={props.onDiscardFile} title="Descartar todos los cambios del archivo">Descartar</button>
                  <button className="btn btn-sm btn-stage" onClick={props.onStageFile} title="Preparar el archivo entero">Preparar</button>
                </>
              )}
              {source.kind === 'staged' && <button className="btn btn-sm" onClick={props.onUnstageFile} title="Quitar el archivo entero de lo preparado">Quitar</button>}
              {editable && (
                <button className="btn btn-sm" onClick={() => props.onEdit!(source.kind === 'staged' ? 'index' : 'working')} title={source.kind === 'staged' ? 'Edita la versión preparada: lo que entrará en el commit' : 'Edita el archivo'}>
                  <Icon.Edit size={13} /> <span className="btn-label">Editar</span>
                </button>
              )}
            </div>
            <div className="diff-tool-group">
              <div className="segmented">
                {(['hunk', 'file', 'split'] as DiffMode[]).map((m) => (
                  <button key={m} className={mode === m ? 'active' : ''} onClick={() => props.onModeChange(m)}>
                    {{ hunk: 'Bloques', file: 'Archivo', split: 'Dividido' }[m]}
                  </button>
                ))}
              </div>
              <button className={`icon-btn ${wrap ? 'active' : ''}`} title="Ajustar líneas largas" onClick={() => props.onWrapChange(!wrap)}>
                <Icon.Wrap size={15} />
              </button>
              {!props.embedded && (
                <>
                  <button className="icon-btn" title="Historial: commits que cambiaron este archivo" onClick={props.onHistory}><Icon.History size={15} /></button>
                  <button className="icon-btn" title="Blame: quién cambió cada línea" onClick={props.onBlame}><Icon.Blame size={15} /></button>
                </>
              )}
            </div>
          </>
        )}
        <button className="icon-btn diff-close" title="Cerrar (Esc)" onClick={props.onClose}>
          <Icon.Close size={15} />
        </button>
      </div>
      {selectable && file && file.hunks.length > 0 && selectedCount === 0 && !hintHidden && (
        <div className="diff-hint">
          <span className="truncate">
            {source.kind === 'unstaged'
              ? 'Pulsa + junto a una línea para prepararla, o haz clic en varias (Mayús: rango) y prepáralas juntas.'
              : 'Pulsa − junto a una línea para quitarla de lo preparado, o haz clic en varias (Mayús: rango) y quítalas juntas.'}
          </span>
          <button className="icon-btn" title="No volver a mostrar" aria-label="Ocultar consejo" onClick={hideHint}>
            <Icon.Close size={12} />
          </button>
        </div>
      )}
      {selectable && selectedCount > 0 && (
        <div className="diff-selbar">
          <span>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? 'línea seleccionada' : 'líneas seleccionadas'}
            {selection.size > 1 ? ` en ${selection.size} bloques` : ''}
          </span>
          <span className="muted small">{source.kind === 'unstaged' ? 'S prepara' : 'U quita'} · Esc deselecciona</span>
          <span className="spacer" />
          {hunkActions.map((action) => (
            <HunkButton key={action} action={action} count={selectedCount} onClick={() => void apply('selection', action)} />
          ))}
          {hunkActions.includes('stage') && props.onEdit && (
            <button className="btn btn-xs" onClick={() => editStaged('selection')} title="Abre la versión preparada con estas líneas para ajustarlas antes de prepararlas">
              <Icon.Edit size={11} /> Editar y preparar…
            </button>
          )}
          <button className="btn btn-xs" onClick={() => setSelection(NONE)}>Deseleccionar</button>
        </div>
      )}
      <div className={`diff-body ${wrap ? 'wrap' : ''} ${mode === 'split' ? 'split' : ''}`}>{body}</div>
    </div>
  )
}

function HunkButton({ action, count, onClick }: { action: HunkAction; count: number; onClick: () => void }) {
  const what = count ? `${count} ${count === 1 ? 'línea' : 'líneas'}` : 'bloque'
  const text = { stage: `Preparar ${what}`, unstage: `Quitar ${what}`, discard: `Descartar ${what}` }[action]
  return (
    <button className={`btn btn-xs ${action === 'discard' ? 'danger' : action === 'stage' ? 'btn-stage' : ''}`} onClick={onClick}>
      {text}
    </button>
  )
}

function Code({ text, lang }: { text: string; lang: string | null }) {
  return <span dangerouslySetInnerHTML={{ __html: highlightCode(text, lang) }} />
}

function LineText({ line, pair, lang }: { line: DiffLine; pair?: DiffLine; lang: string | null }) {
  if (!line.text) return <> </>
  if (!pair || line.type === ' ') return <Code text={line.text} lang={lang} />
  const ranges = line.type === '-' ? intraline(line.text, pair.text) : intraline(pair.text, line.text)
  if (!ranges) return <Code text={line.text} lang={lang} />
  const [a, b] = line.type === '-' ? ranges.old : ranges.new
  return (
    <>
      <Code text={line.text.slice(0, a)} lang={lang} />
      <mark className={line.type === '-' ? 'hl-del' : 'hl-add'}><Code text={line.text.slice(a, b)} lang={lang} /></mark>
      <Code text={line.text.slice(b)} lang={lang} />
    </>
  )
}

type LineActionKind = 'stage' | 'unstage'

interface LineAction {
  kind: LineActionKind
  run: (line: number) => void
  title: (line: number) => string
}

/** El + / − que aparece sobre el número de línea */
function LineButton({ action, line }: { action: LineAction | null; line: number }) {
  if (!action) return null
  return (
    <button
      className={`line-act ${action.kind}`}
      title={action.title(line)}
      aria-label={action.title(line)}
      onClick={(e) => {
        e.stopPropagation()
        action.run(line)
      }}
    >
      {action.kind === 'stage' ? '+' : '−'}
    </button>
  )
}

function UnifiedHunk({ hunk, lang, selected, selectable, onToggle, lineAction }: { hunk: Hunk; lang: string | null } & LinePicking) {
  const pairs = useMemo(() => pairChangedLines(hunk), [hunk])
  return (
    <div className="diff-lines">
      {hunk.lines.map((line, i) => {
        if (line.type === '\\') return <div key={i} className="diff-line meta"><span className="ln" /><span className="ln" /><span className="code">{line.text}</span></div>
        const changed = line.type !== ' '
        const pair = pairs.get(i)
        return (
          <div
            key={i}
            className={`diff-line ${line.type === '+' ? 'add' : line.type === '-' ? 'del' : ''} ${selected?.has(i) ? 'selected' : ''} ${selectable && changed ? 'selectable' : ''}`}
            onClick={(e) => selectable && changed && onToggle(i, e.shiftKey)}
          >
            {changed && <LineButton action={lineAction} line={i} />}
            <span className="ln">{line.oldNo ?? ''}</span>
            <span className="ln">{line.newNo ?? ''}</span>
            <span className="sign">{line.type === ' ' ? '' : line.type}</span>
            <span className="code"><LineText line={line} lang={lang} pair={pair === undefined ? undefined : hunk.lines[pair]} /></span>
          </div>
        )
      })}
    </div>
  )
}

interface LinePicking {
  selected: Set<number> | null
  selectable: boolean
  onToggle: (line: number, shift: boolean) => void
  lineAction: LineAction | null
}

function SplitHunk({ hunk, lang, wrap, ...picking }: { hunk: Hunk; lang: string | null; wrap: boolean } & LinePicking) {
  const rows = useMemo(() => toSplitRows(hunk), [hunk])
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  /** Los dos lados bajan juntos; en horizontal cada uno va por su cuenta */
  const follow = (from: RefObject<HTMLDivElement | null>, to: RefObject<HTMLDivElement | null>) => () => {
    if (from.current && to.current && to.current.scrollTop !== from.current.scrollTop) to.current.scrollTop = from.current.scrollTop
  }
  // Sin ajustar, cada lado ocupa la mitad y se desplaza en horizontal por su cuenta (las filas miden lo mismo y quedan alineadas)
  if (!wrap)
    return (
      <div className="diff-split-cols">
        <div className="split-side" ref={left} onScroll={follow(left, right)}>
          <div className="split-side-lines">
            {rows.map((row, i) => <SplitCell key={i} side={row.left} other={row.right} kind="del" lang={lang} {...picking} />)}
          </div>
        </div>
        <div className="split-side" ref={right} onScroll={follow(right, left)}>
          <div className="split-side-lines">
            {rows.map((row, i) => <SplitCell key={i} side={row.right} other={row.left} kind="add" lang={lang} {...picking} />)}
          </div>
        </div>
      </div>
    )
  return (
    <div className="diff-split">
      {rows.map((row, i) => (
        <Fragment key={i}>
          <SplitCell side={row.left} other={row.right} kind="del" lang={lang} {...picking} />
          <SplitCell side={row.right} other={row.left} kind="add" lang={lang} {...picking} />
        </Fragment>
      ))}
    </div>
  )
}

function SplitCell({ side, other, kind, lang, selected, selectable, onToggle, lineAction }: { side?: { line: DiffLine; index: number }; other?: { line: DiffLine }; kind: 'add' | 'del'; lang: string | null } & LinePicking) {
  if (!side) return <div className="diff-line empty-side"><span className="ln" /><span className="code" /></div>
  const changed = side.line.type !== ' '
  return (
    <div
      className={`diff-line ${changed ? kind : ''} ${changed && selected?.has(side.index) ? 'selected' : ''} ${selectable && changed ? 'selectable' : ''}`}
      onClick={(e) => selectable && changed && onToggle(side.index, e.shiftKey)}
    >
      {changed && <LineButton action={lineAction} line={side.index} />}
      <span className="ln">{kind === 'del' ? side.line.oldNo : side.line.newNo}</span>
      <span className="code"><LineText line={side.line} lang={lang} pair={changed && other && other.line.type !== ' ' ? other.line : undefined} /></span>
    </div>
  )
}

function ConflictText({ text }: { text: string }) {
  let zone: 'none' | 'ours' | 'base' | 'theirs' = 'none'
  const lines = text.split('\n')
  return (
    <div className="diff-lines conflict">
      {lines.map((line, i) => {
        let cls = zone === 'none' ? '' : `zone-${zone}`
        if (line.startsWith('<<<<<<<')) {
          zone = 'ours'
          cls = 'marker'
        } else if (line.startsWith('|||||||')) {
          zone = 'base'
          cls = 'marker'
        } else if (line.startsWith('=======') && zone !== 'none') {
          zone = 'theirs'
          cls = 'marker'
        } else if (line.startsWith('>>>>>>>')) {
          zone = 'none'
          cls = 'marker'
        }
        return (
          <div key={i} className={`diff-line ${cls}`}>
            <span className="ln">{i + 1}</span>
            <span className="code">{line || ' '}</span>
          </div>
        )
      })}
    </div>
  )
}
