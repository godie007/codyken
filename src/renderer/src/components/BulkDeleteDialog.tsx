import { useState } from 'react'
import type { BulkDeletePlan } from '../lib/bulkdelete'
import type { Ref } from '../../../shared/types'

function RefList({ title, refs, note }: { title: string; refs: Ref[]; note?: (ref: Ref) => string | undefined }) {
  if (!refs.length) return null
  return (
    <>
      <div className="bulk-title">{title} ({refs.length})</div>
      <ul className="bulk-list">
        {refs.map((ref) => (
          <li key={ref.fullName} title={ref.name}>
            <span className="truncate">{ref.name}</span>
            {note?.(ref) && <span className="bulk-note">{note(ref)}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

export function BulkDeleteDialog({ plan, onClose }: { plan: BulkDeletePlan; onClose: (result: { withTwins: boolean } | null) => void }) {
  const [withTwins, setWithTwins] = useState(false)
  const remotes = plan.remotes.length + (withTwins ? plan.twins.length : 0)
  const total = plan.locals.length + remotes
  const reasons = new Map(plan.blocked.map((b) => [b.ref.fullName, b.reason]))
  return (
    <div className="modal-backdrop" onMouseDown={() => onClose(null)}>
      <div className="modal bulk-delete" role="dialog" aria-label="Eliminar ramas" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose(null)}>
        <h3>{total ? `Eliminar ${total} ${total === 1 ? 'rama' : 'ramas'}` : 'No hay ramas que se puedan eliminar'}</h3>
        <div className="bulk-body">
          <RefList title="Locales" refs={plan.locals} />
          <RefList title="Remotas" refs={[...plan.remotes, ...(withTwins ? plan.twins.map((t) => t.remote) : [])]} />
          <RefList title="No se eliminan" refs={plan.blocked.map((b) => b.ref)} note={(ref) => reasons.get(ref.fullName)} />
        </div>
        {plan.twins.length > 0 && (
          <label className="checkbox">
            <input type="checkbox" checked={withTwins} onChange={(e) => setWithTwins(e.target.checked)} />
            Eliminar también {plan.twins.length === 1 ? `${plan.twins[0].remote.name} del remoto` : `sus ${plan.twins.length} ramas en el remoto`}
          </label>
        )}
        {remotes > 0 && <div className="bulk-warning">Las remotas se borran del servidor para todo el equipo y Deshacer no las recupera.</div>}
        {plan.locals.length > 0 && <div className="bulk-hint">Las locales se recuperan con Deshacer.</div>}
        <div className="modal-actions">
          <button className="btn" autoFocus onClick={() => onClose(null)}>{total ? 'Cancelar' : 'Cerrar'}</button>
          {total > 0 && <button className="btn danger" onClick={() => onClose({ withTwins })}>Eliminar {total} {total === 1 ? 'rama' : 'ramas'}</button>}
        </div>
      </div>
    </div>
  )
}
