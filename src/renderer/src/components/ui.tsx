import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { hashColor, initials, ltr, splitMiddle, splitPath } from '../lib/format'
import { Icon } from './Icons'

// ── Nombres de archivo ──────────────────────────────────────────────────────

/** Nombre recortado por el medio: el principio y la extensión son lo que distingue a un archivo de otro */
export function FileName({ name, className = '' }: { name: string; className?: string }) {
  const { head, tail } = splitMiddle(name)
  return (
    <span className={`file-name-text ${className}`}>
      <span className="file-name-head">{head}</span>
      {tail && <span className="file-name-tail">{tail}</span>}
    </span>
  )
}

/** Ruta para las barras de herramientas: el nombre siempre se ve y la carpeta, detrás, solo si cabe */
export function FilePath({ path, prefix }: { path: string; prefix?: string }) {
  const { dir, name } = splitPath(path)
  return (
    <span className="diff-path" title={path}>
      <span className="diff-path-main">
        {prefix && <span className="diff-path-prefix">{prefix}</span>}
        <FileName name={name} className="diff-path-name" />
      </span>
      {dir && <span className="diff-path-dir truncate-start">{ltr(dir.slice(0, -1))}</span>}
    </span>
  )
}

// ── Avisos ──────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, detail?: string) => void
}

const ToastContext = createContext<ToastApi>({ toast: () => {} })
export const useToast = (): ToastApi => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, kind, title, detail }])
      setTimeout(() => dismiss(id), kind === 'error' ? 12000 : 4000)
    },
    [dismiss]
  )
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon">{t.kind === 'error' ? <Icon.Warning /> : <Icon.Check />}</span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.detail && <pre className="toast-detail">{t.detail}</pre>}
            </div>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Cerrar">
              <Icon.Close size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Diálogo para pedir un texto ─────────────────────────────────────────────

export interface PromptOptions {
  title: string
  label?: string
  placeholder?: string
  initial?: string
  confirmLabel?: string
  multiline?: boolean
  optional?: boolean
  checkboxLabel?: string
  checkboxDefault?: boolean
  secondaryLabel?: string
  secondaryPlaceholder?: string
  validate?: (value: string) => string | null
}

export interface PromptResult {
  value: string
  secondary: string
  checked: boolean
}

type PromptFn = (options: PromptOptions) => Promise<PromptResult | null>
const PromptContext = createContext<PromptFn>(async () => null)
export const usePrompt = (): PromptFn => useContext(PromptContext)

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: PromptOptions; resolve: (r: PromptResult | null) => void } | null>(null)
  const prompt = useCallback<PromptFn>((options) => new Promise((resolve) => setState({ options, resolve })), [])
  const close = (result: PromptResult | null): void => {
    state?.resolve(result)
    setState(null)
  }
  return (
    <PromptContext.Provider value={prompt}>
      {children}
      {state && <PromptDialog options={state.options} onClose={close} />}
    </PromptContext.Provider>
  )
}

function PromptDialog({ options, onClose }: { options: PromptOptions; onClose: (r: PromptResult | null) => void }) {
  const [value, setValue] = useState(options.initial ?? '')
  const [secondary, setSecondary] = useState('')
  const [checked, setChecked] = useState(options.checkboxDefault ?? false)
  const error = value.trim() ? options.validate?.(value.trim()) ?? null : null
  const canSubmit = (options.optional || !!value.trim()) && !error
  const submit = (): void => {
    if (canSubmit) onClose({ value: value.trim(), secondary: secondary.trim(), checked })
  }
  return (
    <div className="modal-backdrop" onMouseDown={() => onClose(null)}>
      <div
        className="modal"
        role="dialog"
        aria-label={options.title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose(null)
          if (e.key === 'Enter' && (!options.multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
      >
        <h3>{options.title}</h3>
        {options.label && <label className="field-label">{options.label}</label>}
        {options.multiline ? (
          <textarea autoFocus className="input" rows={4} value={value} placeholder={options.placeholder} onChange={(e) => setValue(e.target.value)} />
        ) : (
          <input autoFocus className="input" value={value} placeholder={options.placeholder} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        )}
        {options.secondaryLabel && (
          <>
            <label className="field-label">{options.secondaryLabel}</label>
            <textarea className="input" rows={3} value={secondary} placeholder={options.secondaryPlaceholder} onChange={(e) => setSecondary(e.target.value)} />
          </>
        )}
        {error && <div className="field-error">{error}</div>}
        {options.checkboxLabel && (
          <label className="checkbox">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {options.checkboxLabel}
          </label>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={() => onClose(null)}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            {options.confirmLabel ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Separador redimensionable ───────────────────────────────────────────────

export function Resizer({ onResize, side, onReset, className = 'resizer' }: { onResize: (delta: number) => void; side: 'left' | 'right'; onReset?: () => void; className?: string }) {
  const [dragging, setDragging] = useState(false)
  const last = useRef(0)
  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent): void => {
      const delta = e.clientX - last.current
      last.current = e.clientX
      onResize(side === 'left' ? delta : -delta)
    }
    const up = (): void => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.classList.add('resizing')
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.classList.remove('resizing')
    }
  }, [dragging, onResize, side])
  return (
    <div
      className={`${className} ${dragging ? 'active' : ''}`}
      onMouseDown={(e) => {
        last.current = e.clientX
        setDragging(true)
      }}
      onDoubleClick={onReset}
    />
  )
}

export function Avatar({ name, email, size = 20 }: { name: string; email: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, background: hashColor(email || name) }} title={`${name} <${email}>`}>
      {initials(name)}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const label = status === '?' ? 'A' : status
  const title = { M: 'Modificado', A: 'Añadido', D: 'Eliminado', R: 'Renombrado', C: 'Copiado', U: 'En conflicto', '?': 'Nuevo' }[status] ?? status
  return (
    <span className={`status-badge status-${status === '?' ? 'N' : status}`} title={title}>
      {label}
    </span>
  )
}
