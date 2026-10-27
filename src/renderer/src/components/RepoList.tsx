import { useEffect, useMemo, useRef, useState } from 'react'
import { api, mod } from '../api'
import { homeRelative, ltr, repoName } from '../lib/format'
import { matchRepos } from '../lib/repos'
import { Icon } from './Icons'
import { useToast } from './ui'

export interface RepoListProps {
  recent: string[]
  /** Repos que tienen una pestaña abierta */
  openRepos: string[]
  current?: string
  autoFocus?: boolean
  onOpen: (path: string) => void
  onRemove: (paths: string[]) => void
  /** Esc con el buscador vacío */
  onEscape?: () => void
}

export function RepoList(props: RepoListProps) {
  const { recent } = props
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const list = useRef<HTMLDivElement>(null)

  const recentKey = recent.join('\n')
  useEffect(() => {
    let alive = true
    api.getRecentRepos().then(
      (repos) => alive && setMissing(new Set(repos.filter((r) => !r.exists).map((r) => r.path))),
      () => {}
    )
    return () => {
      alive = false
    }
  }, [recentKey])

  const results = useMemo(() => matchRepos(recent, query), [recent, query])
  const open = useMemo(() => new Set(props.openRepos), [props.openRepos])
  const missingCount = recent.filter((p) => missing.has(p)).length

  useEffect(() => setActive(0), [query])
  useEffect(() => setActive((a) => Math.min(a, Math.max(0, results.length - 1))), [results.length])
  useEffect(() => {
    list.current?.querySelector('.repo-row.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const remove = (paths: string[]): void => {
    if (paths.length) props.onRemove(paths)
  }

  const choose = async (path: string | undefined): Promise<void> => {
    if (!path) return
    if (!missing.has(path)) return props.onOpen(path)
    const ok = await api.confirm({
      message: `No se encontró «${repoName(path)}»`,
      detail: `${homeRelative(path)} se movió, se borró o ya no es un repositorio Git. ¿Quitarlo de la lista?`,
      confirmLabel: 'Quitar de la lista'
    })
    if (ok) remove([path])
  }

  const rowMenu = async (path: string): Promise<void> => {
    const id = await api.contextMenu([
      { id: 'open', label: path === props.current ? 'Es el repositorio actual' : open.has(path) ? 'Ir a su pestaña' : 'Abrir', enabled: path !== props.current && !missing.has(path) },
      { id: 'copy', label: 'Copiar ruta' },
      { type: 'separator' },
      { id: 'remove', label: 'Quitar de la lista' }
    ])
    if (id === 'open') props.onOpen(path)
    else if (id === 'copy') void api.copyText(path).then(() => toast('success', 'Ruta copiada', homeRelative(path)))
    else if (id === 'remove') remove([path])
  }

  const removeMissing = (): void => {
    remove(recent.filter((p) => missing.has(p)))
    toast('success', missingCount === 1 ? 'Se quitó 1 repositorio que ya no existe' : `Se quitaron ${missingCount} repositorios que ya no existen`)
  }

  const clearAll = async (): Promise<void> => {
    const ok = await api.confirm({
      message: '¿Vaciar la lista de repositorios recientes?',
      detail: 'Solo se borra la lista: los repositorios y las pestañas abiertas no se tocan. Cada repo vuelve a la lista al abrirlo.',
      confirmLabel: 'Vaciar lista',
      destructive: true
    })
    if (ok) remove(recent)
  }

  return (
    <div className="repo-list">
      <div className="repo-list-head">
        <span className="repo-list-title">Repositorios recientes</span>
        {recent.length > 0 && <span className="repo-list-count">{recent.length}</span>}
        <span className="spacer" />
        {missingCount > 0 && (
          <button className="link" onClick={removeMissing} title="Quitar de la lista los repos cuya carpeta ya no existe">
            Quitar no encontrados ({missingCount})
          </button>
        )}
        {recent.length > 0 && (
          <button className="link" onClick={() => void clearAll()}>
            Vaciar
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div className="repo-list-search">
          <Icon.Search size={13} />
          <input
            autoFocus={props.autoFocus}
            className="input"
            placeholder="Buscar por nombre o ruta…"
            value={query}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(results.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                void choose(results[active])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                if (query) setQuery('')
                else props.onEscape?.()
              }
            }}
          />
        </div>
      )}

      <div className="repo-list-items" ref={list}>
        {recent.length === 0 && <div className="repo-list-empty">Los repositorios que abras aparecerán aquí.</div>}
        {recent.length > 0 && results.length === 0 && <div className="repo-list-empty">Ningún repositorio coincide con «{query}».</div>}
        {results.map((path, i) => {
          const gone = missing.has(path)
          return (
            <div
              key={path}
              className={`repo-row ${i === active ? 'active' : ''} ${gone ? 'missing' : ''}`}
              title={path}
              onMouseEnter={() => setActive(i)}
              onClick={() => void choose(path)}
              onContextMenu={(e) => {
                e.preventDefault()
                void rowMenu(path)
              }}
            >
              <span className="repo-row-icon">{gone ? <Icon.Warning size={15} /> : <Icon.Folder size={15} />}</span>
              <span className="repo-row-text">
                <span className="repo-row-name truncate">{repoName(path)}</span>
                <span className="repo-row-path truncate-start">{ltr(homeRelative(path))}</span>
              </span>
              {gone ? (
                <span className="repo-tag warn">no encontrado</span>
              ) : path === props.current ? (
                <span className="repo-tag">actual</span>
              ) : open.has(path) ? (
                <span className="repo-tag muted-tag">en pestaña</span>
              ) : null}
              <button
                className="icon-btn repo-row-remove"
                title="Quitar de la lista"
                aria-label={`Quitar ${repoName(path)} de la lista`}
                onClick={(e) => {
                  e.stopPropagation()
                  remove([path])
                }}
              >
                <Icon.Close size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface RepoSwitcherProps extends RepoListProps {
  onClose: () => void
  onOpenDialog: () => void
  onNewTab: () => void
}

/** Desplegable del nombre del repo en la barra: la lista de recientes más abrir, clonar o crear. */
export function RepoSwitcher(props: RepoSwitcherProps) {
  const box = useRef<HTMLDivElement>(null)
  const { onClose } = props

  useEffect(() => {
    const down = (e: MouseEvent): void => {
      const target = e.target as Element | null
      if (box.current?.contains(target) || target?.closest?.('.repo-select')) return
      onClose()
    }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [onClose])

  const then = (action: () => void) => (): void => {
    onClose()
    action()
  }

  return (
    <div className="repo-switcher" ref={box}>
      <RepoList
        {...props}
        autoFocus
        onEscape={onClose}
        onOpen={(path) => {
          onClose()
          props.onOpen(path)
        }}
      />
      <div className="repo-switcher-foot">
        <button className="btn btn-sm" onClick={then(props.onOpenDialog)}>
          <Icon.Folder size={13} /> Abrir repositorio… <kbd>{mod}O</kbd>
        </button>
        <button className="btn btn-sm" onClick={then(props.onNewTab)} title="Abre una pestaña nueva con las opciones de clonar y crear">
          <Icon.Download size={13} /> Clonar o crear…
        </button>
      </div>
    </div>
  )
}
