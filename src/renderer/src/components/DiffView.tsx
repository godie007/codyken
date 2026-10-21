import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DiffMode, DiffSource } from '../../../shared/types'
import { api } from '../api'
import { intraline, pairChangedLines, parseDiff, toSplitRows, type DiffLine, type Hunk } from '../lib/diff'
import { shortHash } from '../lib/format'
import { highlightCode, languageFor } from '../lib/highlight'
import { buildHunkPatch, hasChanges, supportsPartialStaging } from '../lib/patch'
import { Icon } from './Icons'
import { StatusBadge, useToast } from './ui'

const LINE_LIMIT = 6000

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
  embedded?: boolean
}

type HunkAction = 'stage' | 'unstage' | 'discard'

export function DiffView(props: DiffViewProps) {
  const { repo, source, mode, wrap, version } = props
  const { toast } = useToast()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ hunk: number; lines: Set<number> } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const anchor = useRef<{ hunk: number; line: number } | null>(null)
  const sourceKey = JSON.stringify(source)
  const full = mode === 'file'

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
    setSelection(null)
    setShowAll(false)
  }, [sourceKey, version, mode])

  const file = useMemo(() => (text !== null && source.kind !== 'conflict' ? parseDiff(text)[0] ?? null : null), [text, source.kind])
  const partial = !!file && supportsPartialStaging(file)
  const hunkActions: HunkAction[] =
    source.kind === 'unstaged' && partial ? ['discard', 'stage'] : source.kind === 'staged' && partial ? ['unstage'] : []
  const selectable = hunkActions.length > 0 && mode !== 'split'
  const lang = useMemo(() => languageFor(source.path), [source.path])

  const apply = async (hunkIndex: number, onlySelected: boolean, action: HunkAction): Promise<void> => {
    if (!file) return
    const hunk = file.hunks[hunkIndex]
    const selected = onlySelected && selection?.hunk === hunkIndex ? selection.lines : null
    if (!hasChanges(hunk, selected)) return
    if (action === 'discard') {
      const ok = await api.confirm({
        message: selected ? '¿Descartar las líneas seleccionadas?' : '¿Descartar este bloque de cambios?',
        detail: 'Los cambios se pierden del archivo de trabajo y no se pueden recuperar.',
        confirmLabel: 'Descartar',
        destructive: true
      })
      if (!ok) return
    }
    try {
      await api.applyPatch(repo, buildHunkPatch(file, hunk, selected, action !== 'stage'), action !== 'discard', action !== 'stage')
      setSelection(null)
      props.onChanged()
    } catch (e) {
      toast('error', 'No se pudo aplicar el cambio', e instanceof Error ? e.message : String(e))
    }
  }

  const toggleLine = (hunk: number, line: number, shift: boolean): void => {
    setSelection((current) => {
      const same = current?.hunk === hunk
      const lines = new Set(same ? current!.lines : [])
      if (shift && anchor.current?.hunk === hunk) {
        const [a, b] = [anchor.current.line, line].sort((x, y) => x - y)
        const changeLines = file!.hunks[hunk].lines
        for (let i = a; i <= b; i++) if (changeLines[i].type === '+' || changeLines[i].type === '-') lines.add(i)
      } else if (lines.has(line)) lines.delete(line)
      else lines.add(line)
      anchor.current = { hunk, line }
      return lines.size ? { hunk, lines } : null
    })
  }

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
      const selectedHere = selection?.hunk === hi ? selection.lines : null
      hunks.push(
        <div className="hunk" key={hi}>
          {mode !== 'file' || hunkActions.length > 0 ? (
            <div className="hunk-header">
              <span className="mono hunk-range">{mode === 'file' ? 'Archivo completo' : hunk.header}</span>
              <span className="spacer" />
              {hunkActions.map((action) => (
                <HunkButton key={action} action={action} count={selectedHere?.size ?? 0} onClick={() => void apply(hi, !!selectedHere, action)} />
              ))}
            </div>
          ) : null}
          {mode === 'split' ? (
            <SplitHunk hunk={hunk} lang={lang} />
          ) : (
            <UnifiedHunk hunk={hunk} lang={lang} selected={selectedHere} selectable={selectable} onToggle={(line, shift) => toggleLine(hi, line, shift)} />
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
        <span className="diff-path truncate" title={source.path}>{source.path}</span>
        <span className="diff-source">{label}</span>
        <span className="spacer" />
        {source.kind === 'conflict' ? (
          <>
            <button className="btn btn-sm" onClick={() => props.onResolveConflict('ours')} title="git checkout --ours">Usar versión HEAD</button>
            <button className="btn btn-sm" onClick={() => props.onResolveConflict('theirs')} title="git checkout --theirs">Usar versión entrante</button>
            <button className="btn btn-sm btn-primary" onClick={props.onStageFile}>Marcar resuelto</button>
          </>
        ) : (
          <>
            {source.kind === 'unstaged' && (
              <>
                <button className="btn btn-sm danger" onClick={props.onDiscardFile}>Descartar archivo</button>
                <button className="btn btn-sm btn-stage" onClick={props.onStageFile}>Preparar archivo</button>
              </>
            )}
            {source.kind === 'staged' && <button className="btn btn-sm" onClick={props.onUnstageFile}>Quitar archivo</button>}
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
                <button className="btn btn-sm" title="Commits que cambiaron este archivo" onClick={props.onHistory}><Icon.History size={13} /> Historial</button>
                <button className="btn btn-sm" title="Quién cambió cada línea" onClick={props.onBlame}><Icon.Blame size={13} /> Blame</button>
              </>
            )}
          </>
        )}
        <button className="icon-btn" title="Cerrar (Esc)" onClick={props.onClose}>
          <Icon.Close size={15} />
        </button>
      </div>
      {selectable && file && file.hunks.length > 0 && !selection && (
        <div className="diff-hint">Consejo: haz clic en líneas añadidas o eliminadas (Mayús para un rango) para preparar solo esas líneas.</div>
      )}
      <div className={`diff-body ${wrap ? 'wrap' : ''}`}>{body}</div>
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

function UnifiedHunk({ hunk, lang, selected, selectable, onToggle }: { hunk: Hunk; lang: string | null; selected: Set<number> | null; selectable: boolean; onToggle: (line: number, shift: boolean) => void }) {
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

function SplitHunk({ hunk, lang }: { hunk: Hunk; lang: string | null }) {
  const rows = useMemo(() => toSplitRows(hunk), [hunk])
  return (
    <div className="diff-split">
      {rows.map((row, i) => (
        <Fragment key={i}>
          <SplitCell side={row.left} other={row.right} kind="del" lang={lang} />
          <SplitCell side={row.right} other={row.left} kind="add" lang={lang} />
        </Fragment>
      ))}
    </div>
  )
}

function SplitCell({ side, other, kind, lang }: { side?: { line: DiffLine }; other?: { line: DiffLine }; kind: 'add' | 'del'; lang: string | null }) {
  if (!side) return <div className="diff-line empty-side"><span className="ln" /><span className="code" /></div>
  const changed = side.line.type !== ' '
  return (
    <div className={`diff-line ${changed ? kind : ''}`}>
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
