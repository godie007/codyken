import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ConflictVersions } from '../../../shared/types'
import { api } from '../api'
import { hasMarkers, joinResult, parseConflicts, resultLines, toggleSide, wholeFileConflict, type Choice, type ParsedConflict, type Side } from '../lib/conflict'
import { highlightCode, languageFor } from '../lib/highlight'
import { Icon } from './Icons'
import { FilePath } from './ui'
import { useToast } from './ui'

/** Tramos iguales más largos que esto se pliegan, dejando unas líneas de contexto */
const FOLD_OVER = 8
const CONTEXT = 3

export interface MergeEditorProps {
  repo: string
  path: string
  /** Rama en la que estás: es la que git llama HEAD en los marcadores */
  currentBranch: string | null
  onClose: () => void
  onSaved: () => void
  onResolveSide: (side: Side) => void
}

export function MergeEditor({ repo, path, currentBranch, onClose, onSaved, onResolveSide }: MergeEditorProps) {
  const { toast } = useToast()
  const [versions, setVersions] = useState<ConflictVersions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [choices, setChoices] = useState<Choice[]>([])
  const [manual, setManual] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const lang = useMemo(() => languageFor(path), [path])

  useEffect(() => {
    let alive = true
    setVersions(null)
    setError(null)
    setManual(null)
    setExpanded(new Set())
    api.getConflictVersions(repo, path).then(
      (v) => alive && setVersions(v),
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [repo, path])

  const parsed: ParsedConflict | null = useMemo(() => {
    if (!versions || versions.binary) return null
    const fromMarkers = parseConflicts(versions.working)
    if (fromMarkers && fromMarkers.conflicts > 0) return fromMarkers
    if (!hasMarkers(versions.working) && (versions.ours !== null || versions.theirs !== null) && versions.ours !== versions.theirs) {
      return wholeFileConflict(versions.ours, versions.theirs, versions.base)
    }
    return fromMarkers
  }, [versions])

  useEffect(() => setChoices(parsed ? Array.from({ length: parsed.conflicts }, () => null) : []), [parsed])

  const lines = useMemo(() => (parsed ? resultLines(parsed, choices) : []), [parsed, choices])
  const resolved = choices.filter((c) => c !== null).length
  const total = parsed?.conflicts ?? 0
  const output = manual ?? (parsed ? joinResult(parsed, lines.map((l) => l.text)) : '')

  const setChoice = (index: number, choice: Choice): void => {
    setChoices((list) => list.map((c, i) => (i === index ? choice : c)))
  }
  const chooseAll = (side: Side): void => setChoices((list) => list.map(() => [side]))

  const scrollTo = (index: number): void => {
    top.current?.querySelector(`[data-conflict="${index}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    bottom.current?.querySelector(`[data-conflict="${index}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const nextPending = (): void => {
    const index = choices.findIndex((c) => c === null)
    if (index !== -1) scrollTo(index)
  }

  const save = async (): Promise<void> => {
    if (hasMarkers(output)) {
      const ok = await api.confirm({
        message: 'El resultado todavía tiene marcadores de conflicto',
        detail: 'Si lo guardas así, el archivo quedará marcado como resuelto con los marcadores dentro.',
        confirmLabel: 'Guardar igualmente',
        destructive: true
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      await api.saveConflictResolution(repo, path, output)
      toast('success', `${path} resuelto`, 'Se guardó y quedó preparado para el commit.')
      onSaved()
    } catch (e) {
      toast('error', 'No se pudo guardar', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const code = (text: string): ReactNode => <span className="code" dangerouslySetInnerHTML={{ __html: highlightCode(text, lang) || ' ' }} />

  // ── Paneles superiores: HEAD a la izquierda, entrante a la derecha, alineados fila a fila ──
  const topRows: ReactNode[] = []
  if (parsed) {
    let left = 1
    let right = 1
    parsed.segments.forEach((seg, s) => {
      if (seg.kind === 'common') {
        const n = seg.lines.length
        const isFirst = s === 0
        const isLast = s === parsed.segments.length - 1
        const fold = n > FOLD_OVER && !expanded.has(s)
        const visible = (i: number): boolean => !fold || (!isFirst && i < CONTEXT) || (!isLast && i >= n - CONTEXT)
        let folded = false
        seg.lines.forEach((text, i) => {
          if (visible(i)) {
            topRows.push(
              <div key={`c${s}-${i}`} className="merge-row common">
                <span className="ln">{left + i}</span>{code(text)}
                <span className="ln">{right + i}</span>{code(text)}
              </div>
            )
          } else if (!folded) {
            folded = true
            const hidden = seg.lines.filter((_, k) => !visible(k)).length
            topRows.push(
              <button key={`f${s}`} className="merge-fold" onClick={() => setExpanded((set) => new Set(set).add(s))}>
                ⋯ {hidden} {hidden === 1 ? 'línea igual' : 'líneas iguales'} en los dos lados
              </button>
            )
          }
        })
        left += n
        right += n
        return
      }
      const choice = choices[seg.index] ?? null
      const picked = (side: Side): boolean => !!choice?.includes(side)
      const order = (side: Side): string => (choice && choice.length > 1 ? ` ${choice.indexOf(side) + 1}º` : '')
      topRows.push(
        <div key={`h${s}`} className={`merge-conflict-head ${choice === null ? 'pending' : 'done'}`} data-conflict={seg.index}>
          <label className={`merge-pick ${picked('ours') ? 'on' : ''}`}>
            <input type="checkbox" checked={picked('ours')} onChange={() => setChoice(seg.index, toggleSide(choice, 'ours'))} />
            Usar HEAD{order('ours')}
          </label>
          <span className="merge-conflict-title">
            Conflicto {seg.index + 1} de {total}
            <button className="link" onClick={() => setChoice(seg.index, choice?.length === 0 ? null : [])}>{choice?.length === 0 ? 'Deshacer «ninguno»' : 'Ninguno'}</button>
          </span>
          <label className={`merge-pick right ${picked('theirs') ? 'on' : ''}`}>
            Usar entrante{order('theirs')}
            <input type="checkbox" checked={picked('theirs')} onChange={() => setChoice(seg.index, toggleSide(choice, 'theirs'))} />
          </label>
        </div>
      )
      const rows = Math.max(seg.ours.length, seg.theirs.length, 1)
      for (let i = 0; i < rows; i++) {
        const l = seg.ours[i]
        const r = seg.theirs[i]
        topRows.push(
          <div key={`x${s}-${i}`} className={`merge-row conflict ${choice === null ? '' : 'resolved'}`}>
            <span className="ln">{l !== undefined ? left + i : ''}</span>
            <span className={`side ours ${l === undefined ? 'filler' : ''} ${picked('ours') ? 'picked' : choice ? 'unpicked' : ''}`}>{l !== undefined ? code(l) : null}</span>
            <span className="ln">{r !== undefined ? right + i : ''}</span>
            <span className={`side theirs ${r === undefined ? 'filler' : ''} ${picked('theirs') ? 'picked' : choice ? 'unpicked' : ''}`}>{r !== undefined ? code(r) : null}</span>
          </div>
        )
      }
      left += seg.ours.length
      right += seg.theirs.length
    })
  }

  const firstConflict = parsed?.segments.find((s) => s.kind === 'conflict')
  const markerOurs = firstConflict?.kind === 'conflict' ? firstConflict.oursLabel : ''
  const oursLabel = markerOurs && markerOurs !== 'HEAD' ? markerOurs : currentBranch ?? 'tu versión'
  const theirsLabel = firstConflict?.kind === 'conflict' ? firstConflict.theirsLabel || 'entrante' : 'entrante'

  return (
    <div className="file-tool merge-editor">
      <div className="diff-toolbar">
        <Icon.Merge3 size={15} />
        <FilePath path={path} prefix="Resolver" />
        {parsed && total > 0 && (
          <span className={`diff-source ${resolved === total ? 'ok-text' : ''}`}>
            {resolved}/{total} {total === 1 ? 'resuelto' : 'resueltos'}
          </span>
        )}
        <span className="spacer" />
        {parsed && total > 0 && !manual && (
          <>
            <button className="btn btn-sm" disabled={resolved === total} onClick={nextPending} title="Ir al siguiente conflicto sin resolver">Siguiente</button>
            <button className="btn btn-sm" onClick={() => chooseAll('ours')}>Todo HEAD</button>
            <button className="btn btn-sm" onClick={() => chooseAll('theirs')}>Todo entrante</button>
          </>
        )}
        {parsed && (
          <button className="btn btn-sm btn-primary" disabled={saving || (!manual && resolved < total)} onClick={() => void save()} title={!manual && resolved < total ? 'Resuelve todos los conflictos o edita el resultado a mano' : 'Guarda el archivo y lo prepara'}>
            {saving ? 'Guardando…' : 'Guardar y resolver'}
          </button>
        )}
        <button className="icon-btn" title="Cerrar (Esc)" onClick={onClose}><Icon.Close size={15} /></button>
      </div>

      {error && <div className="empty">{error}</div>}
      {!versions && !error && <div className="empty">Cargando versiones…</div>}
      {versions?.binary && (
        <div className="merge-fallback">
          <p>Es un archivo binario: elige una versión completa.</p>
          <div className="row-gap">
            <button className="btn" onClick={() => onResolveSide('ours')}>Usar versión HEAD</button>
            <button className="btn" onClick={() => onResolveSide('theirs')}>Usar versión entrante</button>
          </div>
        </div>
      )}
      {versions && !versions.binary && !parsed && (
        <div className="merge-fallback">
          <p>No se pudieron leer los marcadores de conflicto (están incompletos o anidados). Edita el archivo en tu editor o elige una versión completa.</p>
          <div className="row-gap">
            <button className="btn" onClick={() => onResolveSide('ours')}>Usar versión HEAD</button>
            <button className="btn" onClick={() => onResolveSide('theirs')}>Usar versión entrante</button>
          </div>
        </div>
      )}

      {parsed && (
        <div className="merge-body">
          <div className="merge-top" ref={top}>
            <div className="merge-cols-head">
              <span><span className="merge-dot ours" /> HEAD <span className="muted">· {oursLabel}</span></span>
              <span><span className="merge-dot theirs" /> Entrante <span className="muted">· {theirsLabel}</span></span>
            </div>
            {total === 0 ? <div className="empty">No quedan marcadores de conflicto en el archivo. Guárdalo para marcarlo como resuelto.</div> : topRows}
          </div>
          <div className="merge-bottom">
            <div className="merge-bottom-head">
              <strong>Resultado</strong>
              <span className="muted small">{manual ? 'Editado a mano: las casillas ya no lo cambian' : 'Se arma con las casillas de arriba'}</span>
              <span className="spacer" />
              {manual === null ? (
                <button className="btn btn-xs" onClick={() => setManual(output)}>Editar a mano</button>
              ) : (
                <button className="btn btn-xs" onClick={() => setManual(null)}>Descartar edición</button>
              )}
            </div>
            {manual !== null ? (
              <textarea className="merge-textarea" value={manual} spellCheck={false} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            ) : (
              <div className="merge-output" ref={bottom}>
                {lines.map((line, i) => (
                  <div key={i} className={`merge-out-line from-${line.from}`} data-conflict={line.conflict !== undefined && (i === 0 || lines[i - 1].conflict !== line.conflict) ? line.conflict : undefined}>
                    <span className="ln">{i + 1}</span>
                    {line.from === 'pending' ? <span className="code">{line.text || ' '}</span> : code(line.text)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
