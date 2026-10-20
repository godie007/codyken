import type { ReactNode } from 'react'
import type { PullMode, Ref, RepoState } from '../../../shared/types'
import { api, mod } from '../api'
import { repoName } from '../lib/format'
import { Icon } from './Icons'

const PULL_LABELS: Record<PullMode, string> = {
  merge: 'Pull (fast-forward si es posible)',
  'ff-only': 'Pull (solo fast-forward)',
  rebase: 'Pull (rebase)'
}

export interface ToolbarProps {
  repo: string
  state: RepoState | null
  headRef: Ref | undefined
  busy: string | null
  undoLabel: string | null
  stashCount: number
  pullMode: PullMode
  leftVisible: boolean
  rightVisible: boolean
  onUndo: () => void
  onPull: (mode: PullMode) => void
  onFetch: () => void
  onPullModeChange: (mode: PullMode) => void
  onPush: () => void
  onBranch: () => void
  onStash: () => void
  onPop: () => void
  onTerminal: () => void
  onPalette: () => void
  onBranchMenu: () => void
  onToggleLeft: () => void
  onToggleRight: () => void
}

export function Toolbar(props: ToolbarProps) {
  const { state, headRef, busy } = props
  const disabled = !!busy

  const pullMenu = async (): Promise<void> => {
    const id = await api.contextMenu([
      { id: 'fetch', label: 'Fetch de todos los remotos', accelerator: 'CmdOrCtrl+L' },
      { type: 'separator' },
      ...(['merge', 'ff-only', 'rebase'] as PullMode[]).map((m) => ({ id: `pull:${m}`, label: PULL_LABELS[m] })),
      { type: 'separator' },
      {
        label: 'Modo predeterminado',
        submenu: (['merge', 'ff-only', 'rebase'] as PullMode[]).map((m) => ({ id: `default:${m}`, label: PULL_LABELS[m], type: 'radio' as const, checked: props.pullMode === m }))
      }
    ])
    if (!id) return
    if (id === 'fetch') props.onFetch()
    else if (id.startsWith('pull:')) props.onPull(id.slice(5) as PullMode)
    else if (id.startsWith('default:')) props.onPullModeChange(id.slice(8) as PullMode)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className={`icon-btn ${props.leftVisible ? 'active' : ''}`} title={`Panel izquierdo (${mod}J)`} onClick={props.onToggleLeft}>
          <Icon.Panel size={16} />
        </button>
        <div className="toolbar-repo">
          <span className="toolbar-repo-name">{repoName(props.repo)}</span>
          <button className="branch-select" onClick={props.onBranchMenu} title="Cambiar de rama" disabled={disabled}>
            <Icon.Branch size={13} />
            <span className="truncate">{state?.branch ?? (state?.head ? 'HEAD desacoplado' : 'sin commits')}</span>
            <Icon.ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="toolbar-actions">
        <ToolButton icon={<Icon.Undo size={17} />} label="Deshacer" disabled={disabled || !props.undoLabel} onClick={props.onUndo} title={props.undoLabel ? `Deshacer: ${props.undoLabel} (${mod}Z)` : 'Nada que deshacer'} />
        <span className="toolbar-sep" />
        <ToolButton icon={<Icon.Download size={17} />} label="Fetch" disabled={disabled} onClick={props.onFetch} title={`Traer cambios de todos los remotos sin tocar tus ramas (${mod}L)`} />
        <div className="split-btn">
          <ToolButton icon={<Icon.Pull size={17} />} label="Pull" badge={headRef?.behind} disabled={disabled} onClick={() => props.onPull(props.pullMode)} title={PULL_LABELS[props.pullMode]} />
          <button className="split-btn-arrow" disabled={disabled} onClick={() => void pullMenu()} title="Opciones de pull">
            <Icon.ChevronDown size={12} />
          </button>
        </div>
        <ToolButton icon={<Icon.Push size={17} />} label="Push" badge={headRef?.ahead} disabled={disabled || !state?.branch} onClick={props.onPush} />
        <span className="toolbar-sep" />
        <ToolButton icon={<Icon.Branch size={17} />} label="Rama" disabled={disabled || !state?.head} onClick={props.onBranch} title={`Nueva rama (${mod}B)`} />
        <ToolButton icon={<Icon.Stash size={17} />} label="Stash" disabled={disabled} onClick={props.onStash} />
        <ToolButton icon={<Icon.Pop size={17} />} label="Pop" badge={props.stashCount || undefined} disabled={disabled || props.stashCount === 0} onClick={props.onPop} />
      </div>

      <div className="toolbar-right">
        {busy && (
          <span className="busy">
            <span className="spinner" /> {busy}…
          </span>
        )}
        <button className="icon-btn" title="Abrir en Terminal" onClick={props.onTerminal}>
          <Icon.Terminal size={16} />
        </button>
        <button className="palette-btn" onClick={props.onPalette}>
          <Icon.Command size={13} /> Acciones <kbd>{mod}P</kbd>
        </button>
        <button className={`icon-btn ${props.rightVisible ? 'active' : ''}`} title={`Panel derecho (${mod}K)`} onClick={props.onToggleRight}>
          <Icon.PanelRight size={16} />
        </button>
      </div>
    </div>
  )
}

function ToolButton({ icon, label, badge, disabled, onClick, title }: { icon: ReactNode; label: string; badge?: number; disabled?: boolean; onClick: () => void; title?: string }) {
  return (
    <button className="tool-btn" disabled={disabled} onClick={onClick} title={title ?? label}>
      <span className="tool-btn-icon">
        {icon}
        {!!badge && <span className="tool-badge">{badge}</span>}
      </span>
      <span className="tool-btn-label">{label}</span>
    </button>
  )
}
