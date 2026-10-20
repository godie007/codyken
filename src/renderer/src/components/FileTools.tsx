import { useEffect, useMemo, useState } from 'react'
import type { BlameLine, DiffMode, FileHistoryEntry } from '../../../shared/types'
import { api } from '../api'
import { formatFullDate, hashColor, relativeTime, shortHash } from '../lib/format'
import { highlightCode, languageFor } from '../lib/highlight'
import { DiffView } from './DiffView'
import { Icon } from './Icons'
import { Avatar, StatusBadge } from './ui'

const BLAME_LIMIT = 8000

export interface FileHistoryProps {
  repo: string
  path: string
  mode: DiffMode
  wrap: boolean
  onModeChange: (mode: DiffMode) => void
  onWrapChange: (wrap: boolean) => void
  onClose: () => void
  onBlame: (rev: string | null) => void
  onSelectCommit: (hash: string) => void
}

export function FileHistory(props: FileHistoryProps) {
  const [entries, setEntries] = useState<FileHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    let alive = true
    setEntries(null)
    setSelected(0)
    api.getFileHistory(props.repo, props.path, 500).then(
      (list) => alive && setEntries(list),
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [props.repo, props.path])

  const entry = entries?.[selected]

  return (
    <div className="file-tool">
      <div className="diff-toolbar">
        <Icon.History size={15} />
        <span className="diff-path truncate">Historial de {props.path}</span>
        {entries && <span className="diff-source">{entries.length} {entries.length === 1 ? 'commit' : 'commits'}</span>}
        <span className="spacer" />
        <button className="btn btn-sm" onClick={() => props.onBlame(null)}><Icon.Blame size={13} /> Blame</button>
        <button className="icon-btn" title="Cerrar (Esc)" onClick={props.onClose}><Icon.Close size={15} /></button>
      </div>
      <div className="file-tool-body">
        <div className="history-list">
          {error && <div className="empty">{error}</div>}
          {!entries && !error && <div className="empty">Cargando…</div>}
          {entries?.length === 0 && <div className="empty">Este archivo no tiene historial confirmado.</div>}
          {entries?.map((e, i) => (
            <div
              key={e.hash}
              className={`history-row ${i === selected ? 'active' : ''}`}
              onClick={() => setSelected(i)}
              onDoubleClick={() => props.onSelectCommit(e.hash)}
              title="Doble clic para ver el commit en el gráfico"
            >
              <Avatar name={e.author} email={e.email} size={24} />
              <div className="history-text">
                <div className="truncate history-subject">{e.subject}</div>
                <div className="history-meta truncate">
                  {e.author} · {relativeTime(e.date)} · <span className="mono">{shortHash(e.hash)}</span>
                  {e.oldPath && <span className="history-rename"> · renombrado desde {e.oldPath}</span>}
                </div>
              </div>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </div>
        <div className="history-diff">
          {entry ? (
            <DiffView
              embedded
              repo={props.repo}
              source={{ kind: 'commit', hash: entry.hash, parent: entry.parents[0] ?? null, path: entry.path, oldPath: entry.oldPath, status: entry.status }}
              mode={props.mode}
              wrap={props.wrap}
              version={0}
              onModeChange={props.onModeChange}
              onWrapChange={props.onWrapChange}
              onClose={props.onClose}
              onChanged={() => {}}
              onStageFile={() => {}}
              onUnstageFile={() => {}}
              onDiscardFile={() => {}}
              onResolveConflict={() => {}}
              onHistory={() => {}}
              onBlame={() => {}}
            />
          ) : (
            <div className="empty">Elige un commit de la lista</div>
          )}
        </div>
      </div>
    </div>
  )
}

export interface BlameViewProps {
  repo: string
  path: string
  rev: string | null
  onClose: () => void
  onHistory: () => void
  onSelectCommit: (hash: string) => void
}

export function BlameView(props: BlameViewProps) {
  const [lines, setLines] = useState<BlameLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const lang = useMemo(() => languageFor(props.path), [props.path])

  useEffect(() => {
    let alive = true
    setLines(null)
    setError(null)
    api.getBlame(props.repo, props.path, props.rev).then(
      (list) => alive && setLines(list),
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [props.repo, props.path, props.rev])

  const authors = useMemo(() => new Set(lines?.map((l) => l.email)).size, [lines])
  const shown = lines?.slice(0, BLAME_LIMIT)

  return (
    <div className="file-tool">
      <div className="diff-toolbar">
        <Icon.Blame size={15} />
        <span className="diff-path truncate">Blame de {props.path}</span>
        <span className="diff-source">{props.rev ? `en ${shortHash(props.rev)}` : 'versión actual'}</span>
        {lines && <span className="diff-source">{lines.length} líneas · {authors} {authors === 1 ? 'autor' : 'autores'}</span>}
        <span className="spacer" />
        <button className="btn btn-sm" onClick={props.onHistory}><Icon.History size={13} /> Historial</button>
        <button className="icon-btn" title="Cerrar (Esc)" onClick={props.onClose}><Icon.Close size={15} /></button>
      </div>
      <div className="diff-body blame-body">
        {error && <div className="empty">{error}</div>}
        {!lines && !error && <div className="empty">Cargando…</div>}
        {shown && (
          <div className="blame-lines" onMouseLeave={() => setHover(null)}>
            {shown.map((line, i) => {
              const first = i === 0 || shown[i - 1].hash !== line.hash
              const uncommitted = /^0+$/.test(line.hash)
              return (
                <div
                  key={i}
                  className={`blame-line ${first ? 'first' : ''} ${hover === line.hash ? 'hover' : ''}`}
                  style={{ ['--blame' as string]: uncommitted ? 'var(--text-faint)' : hashColor(line.hash) }}
                  onMouseEnter={() => setHover(line.hash)}
                >
                  <div
                    className="blame-gutter"
                    onClick={() => !uncommitted && props.onSelectCommit(line.hash)}
                    title={uncommitted ? 'Cambio sin confirmar' : `${line.summary}\n${line.author} · ${formatFullDate(line.date)}\nClic para ver el commit`}
                  >
                    {first &&
                      (uncommitted ? (
                        <span className="blame-info muted">Sin confirmar</span>
                      ) : (
                        <>
                          <Avatar name={line.author} email={line.email} size={16} />
                          <span className="blame-info">
                            <span className="blame-summary truncate">{line.summary}</span>
                            <span className="blame-meta">{line.author.split(' ')[0]} · {relativeTime(line.date)}</span>
                          </span>
                        </>
                      ))}
                  </div>
                  <span className="ln">{line.line}</span>
                  <span className="code" dangerouslySetInnerHTML={{ __html: highlightCode(line.text, lang) || ' ' }} />
                </div>
              )
            })}
          </div>
        )}
        {lines && lines.length > BLAME_LIMIT && <div className="diff-truncated">Se muestran las primeras {BLAME_LIMIT.toLocaleString('es')} líneas.</div>}
      </div>
    </div>
  )
}
