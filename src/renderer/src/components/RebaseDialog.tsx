import { useEffect, useMemo, useState } from 'react'
import type { RebaseAction, RebaseCommit, RebaseMode, RebaseStep } from '../../../shared/types'
import { api } from '../api'
import { relativeTime, shortHash } from '../lib/format'
import { rebaseProblem } from '../lib/rebase'
import { Icon } from './Icons'
import { Avatar } from './ui'

const ACTIONS: { id: RebaseAction; label: string; hint: string }[] = [
  { id: 'pick', label: 'Conservar', hint: 'Se aplica tal cual' },
  { id: 'reword', label: 'Reescribir mensaje', hint: 'Mismo cambio, mensaje nuevo' },
  { id: 'squash', label: 'Combinar con el anterior', hint: 'Se une al commit de arriba y junta los mensajes' },
  { id: 'fixup', label: 'Combinar sin su mensaje', hint: 'Se une al commit de arriba y descarta su mensaje' },
  { id: 'drop', label: 'Descartar', hint: 'El commit desaparece de la rama' }
]

interface Row extends RebaseCommit {
  action: RebaseAction
  draft: string
}

export interface RebaseDialogProps {
  repo: string
  /** Commit desde el que se reescribe (`from`) o rama sobre la que se reconstruye (`onto`) */
  base: string
  mode: RebaseMode
  /** Con `onto`: rama local que se reescribe (puede no ser la actual) */
  tip?: string
  baseName?: string
  branch: string | null
  onClose: () => void
  onStart: (steps: RebaseStep[]) => void
}

export function RebaseDialog({ repo, base, mode, tip, baseName, branch, onClose, onStart }: RebaseDialogProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [original, setOriginal] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const request = mode === 'onto' && tip ? api.getRebaseCommits(repo, base, 'onto', `refs/heads/${tip}`) : api.getRebaseCommits(repo, base)
    request.then(
      (commits) => {
        if (!alive) return
        setRows(commits.map((c) => ({ ...c, action: 'pick', draft: c.message })))
        setOriginal(commits.map((c) => c.hash))
      },
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [repo, base, mode, tip])

  const update = (index: number, patch: Partial<Row>): void => setRows((list) => list && list.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const move = (from: number, to: number): void =>
    setRows((list) => {
      if (!list || to < 0 || to >= list.length || from === to) return list
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })

  const summary = useMemo(() => {
    if (!rows) return null
    const count = (a: RebaseAction): number => rows.filter((r) => r.action === a).length
    const reordered = rows.some((r, i) => r.hash !== original[i])
    // Sobre otra rama el rebase ya cambia la base aunque se conserven todos los commits tal cual
    const changed = mode === 'onto' || reordered || rows.some((r) => r.action !== 'pick')
    const parts = [
      reordered && 'nuevo orden',
      count('reword') && `${count('reword')} reescrito(s)`,
      count('squash') + count('fixup') && `${count('squash') + count('fixup')} combinado(s)`,
      count('drop') && `${count('drop')} descartado(s)`
    ].filter(Boolean)
    const idle = mode === 'onto' ? `Se aplican tal cual encima de ${baseName ?? 'la otra rama'}` : 'Sin cambios todavía'
    return { changed, text: parts.length ? parts.join(' · ') : idle, allDropped: rows.every((r) => r.action === 'drop') }
  }, [rows, original, mode, baseName])

  const problem = rows ? rebaseProblem(rows) : null
  const start = (): void => {
    if (!rows?.length || problem || !summary?.changed) return
    onStart(rows.map((r) => ({ hash: r.hash, action: r.action, ...(r.action === 'reword' ? { message: r.draft } : {}) })))
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rebase-modal" role="dialog" aria-label="Rebase interactivo" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="rebase-head">
          <Icon.Rebase size={18} />
          <div>
            <h3>Rebase interactivo</h3>
            <div className="muted small">
              {branch ?? 'HEAD'} · {rows ? `${rows.length} ${rows.length === 1 ? 'commit' : 'commits'}` : '…'}{' '}
              {mode === 'onto' ? <>sobre <span className="mono">{baseName}</span></> : <>desde <span className="mono">{shortHash(base)}</span></>}
            </div>
          </div>
        </div>
        <p className="rebase-hint muted small">Se aplican de arriba abajo, del más antiguo al más nuevo. Arrastra las filas o usa las flechas para reordenar.</p>

        <div className="rebase-list">
          {error && <div className="empty">{error}</div>}
          {!rows && !error && <div className="empty">Cargando commits…</div>}
          {rows?.length === 0 && <div className="empty">{branch} no tiene commits propios que llevar encima de {baseName}.</div>}
          {rows?.map((row, i) => {
            const combined = row.action === 'squash' || row.action === 'fixup'
            return (
              <div
                key={row.hash}
                className={`rebase-row action-${row.action} ${dragging === i ? 'dragging' : ''} ${dropAt === i && dragging !== i ? 'drop-here' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  setDragging(i)
                }}
                onDragOver={(e) => {
                  if (dragging === null) return
                  e.preventDefault()
                  setDropAt(i)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragging !== null) move(dragging, i)
                  setDragging(null)
                  setDropAt(null)
                }}
                onDragEnd={() => (setDragging(null), setDropAt(null))}
              >
                <div className="rebase-row-main">
                  <span className="rebase-grip" title="Arrastra para reordenar">⋮⋮</span>
                  <select className="input rebase-action" value={row.action} onChange={(e) => update(i, { action: e.target.value as RebaseAction })} title={ACTIONS.find((a) => a.id === row.action)?.hint}>
                    {ACTIONS.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                  <span className="mono rebase-sha">{shortHash(row.hash)}</span>
                  <span className={`rebase-subject truncate ${combined ? 'combined' : ''}`} title={row.message}>
                    {combined && <span className="rebase-into">↑ </span>}
                    {row.action === 'reword' ? row.draft.split('\n')[0] || 'Mensaje nuevo…' : row.subject}
                  </span>
                  <Avatar name={row.author} email={row.email} size={18} />
                  <span className="muted small rebase-date">{relativeTime(row.date)}</span>
                  <button className="icon-btn" title="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <Icon.ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button className="icon-btn" title="Bajar" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>
                    <Icon.ChevronDown size={13} />
                  </button>
                </div>
                {row.action === 'reword' && (
                  <textarea
                    className="input rebase-message"
                    rows={Math.min(6, Math.max(2, row.draft.split('\n').length))}
                    value={row.draft}
                    autoFocus
                    spellCheck={false}
                    onChange={(e) => update(i, { draft: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            )
          })}
        </div>

        {rows && summary && (
          <div className="rebase-foot">
            <div className="rebase-summary small">
              <strong>{summary.text}</strong>
              {problem ? <span className="field-error">{problem}</span> : summary.allDropped ? <span className="warn-text">La rama quedará sin estos commits.</span> : <span className="muted">Reescribe la historia de {branch ?? 'HEAD'}{mode === 'onto' && tip ? ' (se cambia a esa rama)' : ''}; si ya la subiste tendrás que forzar el push. Se puede deshacer con ⌘Z.</span>}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" disabled={!!problem || !summary.changed || rows.length === 0} onClick={start}>Iniciar rebase</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
