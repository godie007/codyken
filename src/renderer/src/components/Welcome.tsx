import { useState } from 'react'
import { api, mod } from '../api'
import { homeRelative, repoName } from '../lib/format'
import { Icon, Logo } from './Icons'
import { useToast } from './ui'

export interface WelcomeProps {
  recent: string[]
  onOpen: (path?: string) => void
  onRemoveRecent: (path: string) => void
}

export function Welcome({ recent, onOpen, onRemoveRecent }: WelcomeProps) {
  const { toast } = useToast()
  const [cloning, setCloning] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const clone = async (): Promise<void> => {
    const parent = await api.pickDirectory('¿En qué carpeta clonar el repositorio?')
    if (!parent) return
    setBusy('Clonando…')
    try {
      onOpen(await api.cloneRepo(url, parent))
    } catch (e) {
      toast('error', 'No se pudo clonar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const init = async (): Promise<void> => {
    const dir = await api.pickDirectory('Carpeta para el nuevo repositorio')
    if (!dir) return
    try {
      onOpen(await api.initRepo(dir))
    } catch (e) {
      toast('error', 'No se pudo crear el repositorio', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-brand">
          <Logo size={44} />
          <div>
            <h1>Codyken</h1>
            <p className="muted">Tu historial de Git, claro y a la mano.</p>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-action" onClick={() => onOpen()}>
            <Icon.Folder size={20} />
            <span>
              <strong>Abrir repositorio</strong>
              <small>Una carpeta con Git en tu equipo</small>
            </span>
          </button>
          <button className={`welcome-action ${cloning ? 'active' : ''}`} onClick={() => setCloning((c) => !c)}>
            <Icon.Download size={20} />
            <span>
              <strong>Clonar</strong>
              <small>Desde GitHub, GitLab o cualquier URL</small>
            </span>
          </button>
          <button className="welcome-action" onClick={() => void init()}>
            <Icon.Sparkle size={20} />
            <span>
              <strong>Crear repositorio</strong>
              <small>Inicia Git en una carpeta</small>
            </span>
          </button>
        </div>

        {cloning && (
          <div className="clone-form">
            <input
              autoFocus
              className="input"
              placeholder="https://github.com/usuario/proyecto.git  o  git@github.com:usuario/proyecto.git"
              value={url}
              spellCheck={false}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && url.trim() && !busy && void clone()}
            />
            <button className="btn btn-primary" disabled={!url.trim() || !!busy} onClick={() => void clone()}>
              {busy ?? 'Elegir carpeta y clonar'}
            </button>
          </div>
        )}

        <div className="recent">
          <div className="recent-title">Recientes</div>
          {recent.length === 0 && <div className="muted small">Los repositorios que abras aparecerán aquí.</div>}
          {recent.map((path) => (
            <div key={path} className="recent-row" onClick={() => onOpen(path)}>
              <Icon.Branch size={15} />
              <span className="recent-name">{repoName(path)}</span>
              <span className="recent-path truncate">{homeRelative(path)}</span>
              <button
                className="icon-btn"
                title="Quitar de recientes"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveRecent(path)
                }}
              >
                <Icon.Close size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="welcome-hint muted small">
          <kbd>{mod}T</kbd> nueva pestaña · <kbd>{mod}P</kbd> acciones · <kbd>{mod}F</kbd> buscar commits
        </div>
      </div>
    </div>
  )
}
