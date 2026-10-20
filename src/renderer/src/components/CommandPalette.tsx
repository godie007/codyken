import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fuzzyScore } from '../lib/fuzzy'

export interface PaletteItem {
  id: string
  label: string
  group: string
  hint?: string
  icon?: ReactNode
  run: () => void
}

export function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const scored: { item: PaletteItem; score: number }[] = []
    for (const item of items) {
      const score = fuzzyScore(query, `${item.group} ${item.label}`)
      const direct = fuzzyScore(query, item.label)
      const best = Math.max(score ?? -Infinity, (direct ?? -Infinity) + 5)
      if (best > -Infinity) scored.push({ item, score: best })
    }
    if (query) scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 80).map((s) => s.item)
  }, [items, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const execute = (item: PaletteItem | undefined): void => {
    if (!item) return
    onClose()
    item.run()
  }

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="palette-input"
          placeholder="Escribe una acción, una rama o un repositorio…"
          value={query}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') execute(results[active])
          }}
        />
        <div className="palette-list" ref={list}>
          {results.length === 0 && <div className="palette-empty">Sin resultados</div>}
          {results.map((item, i) => (
            <button key={item.id} className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => execute(item)}>
              <span className="palette-icon">{item.icon}</span>
              <span className="palette-group">{item.group}</span>
              <span className="palette-label truncate">{item.label}</span>
              {item.hint && <kbd>{item.hint}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
