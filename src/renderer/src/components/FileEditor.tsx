import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { EditableFile, EditTarget } from '../../../shared/types'
import { api } from '../api'
import { detectEol, detectIndent, indentEdit, lineColumn, newlineEdit, offsetOfLine, type TextEdit } from '../lib/editing'
import { highlightCode, languageFor } from '../lib/highlight'
import { lineMarks } from '../lib/linediff'
import { Icon } from './Icons'
import { FilePath, usePrompt, useToast } from './ui'

/** Tienen que coincidir con .fe-highlight / .fe-input en styles.css */
const LINE_HEIGHT = 20
const PAD_TOP = 8
/** Por encima de este tamaño se edita sin colores para que escribir siga siendo fluido */
const HIGHLIGHT_LIMIT = 200_000

export interface EditorRequest {
  path: string
  target: EditTarget
  /** Parche con las líneas elegidas en el diff: se parte de la versión preparada más esas líneas */
  patch?: string
  /** Commit del que se toma el contenido del archivo (solo para el archivo de trabajo) */
  rev?: string
  /** Cómo se nombra ese commit en pantalla */
  revLabel?: string
  /** Para volver a abrir el mismo archivo desde cero */
  nonce: number
}

export interface FileEditorProps {
  repo: string
  request: EditorRequest
  /** Cambia con cada actualización del estado del repo: momento de mirar si el archivo cambió por fuera */
  version: number
  /** Cerrar o cambiar de versión: quien lo abre pregunta si hay cambios sin guardar */
  onClose: () => void
  onSwitch: (target: EditTarget) => void
  onSaved: (target: EditTarget, staged: boolean) => void
  onDirty: (dirty: boolean) => void
}

// Lo escrito sin guardar sobrevive a cambiar de pestaña (el editor se desmonta) mientras el archivo no cambie
const drafts = new Map<string, { text: string; version: string; patch?: string; rev?: string }>()
const draftKey = (repo: string, request: Pick<EditorRequest, 'path' | 'target'>): string => `${repo}\0${request.target}\0${request.path}`
export const dropEditorDraft = (repo: string, request: Pick<EditorRequest, 'path' | 'target'>): void => void drafts.delete(draftKey(repo, request))

const toLf = (text: string): string => text.replace(/\r\n/g, '\n')

export function FileEditor({ repo, request, version, onClose, onSwitch, onSaved, onDirty }: FileEditorProps) {
  const { path, target, patch, rev } = request
  const { toast } = useToast()
  const prompt = usePrompt()
  const key = draftKey(repo, request)
  const [file, setFile] = useState<EditableFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [original, setOriginal] = useState('')
  const [eol, setEol] = useState<'\n' | '\r\n'>('\n')
  const [saving, setSaving] = useState(false)
  /** Versión que llegó de fuera mientras había cambios sin guardar */
  const [external, setExternal] = useState<EditableFile | null>(null)
  const [restored, setRestored] = useState(false)
  /** El texto viene de un commit y todavía no se guardó */
  const [fromRev, setFromRev] = useState(false)
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const input = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const charWidth = useRef(7.2)
  const lang = useMemo(() => languageFor(path), [path])
  const dirty = file !== null && text !== original
  const live = useRef({ file, dirty })
  live.current = { file, dirty }

  const adopt = (f: EditableFile, nextText: string): void => {
    setFile(f)
    setOriginal(toLf(f.content))
    setEol(detectEol(f.content || f.proposed || ''))
    setText(nextText)
    setExternal(null)
  }

  // Carga (y recarga al pedir otro archivo o la otra versión)
  useEffect(() => {
    let alive = true
    setFile(null)
    setError(null)
    setRestored(false)
    setFromRev(false)
    api.readEditable(repo, path, target, patch, rev).then(
      (f) => {
        if (!alive) return
        const draft = drafts.get(key)
        const fromDraft = !!draft && draft.version === f.version && draft.patch === patch && draft.rev === rev
        if (!fromDraft) drafts.delete(key)
        const initial = fromDraft ? draft!.text : toLf(f.proposed ?? f.content)
        adopt(f, initial)
        setRestored(fromDraft)
        setFromRev(!!rev)
        // Cursor en el primer cambio: es donde normalmente se quiere tocar
        const first = f.baseline === null ? -1 : lineMarks(toLf(f.baseline), initial).marks.findIndex(Boolean)
        requestAnimationFrame(() => (first >= 0 ? focusLine(first + 1, initial) : input.current?.focus()))
      },
      (e: Error) => alive && setError(e.message)
    )
    return () => {
      alive = false
    }
  }, [repo, path, target, patch, rev, request.nonce])

  useEffect(() => {
    onDirty(dirty)
  }, [dirty])

  useEffect(() => {
    if (!file) return
    if (dirty) drafts.set(key, { text, version: file.version, patch, rev })
    else drafts.delete(key)
  }, [text, original, file])

  // ¿Cambió por fuera? (otro editor, un checkout, preparar desde otro sitio…)
  const seenVersion = useRef(version)
  useEffect(() => {
    if (version === seenVersion.current) return
    seenVersion.current = version
    let alive = true
    api.readEditable(repo, path, target).then(
      (f) => {
        const current = live.current.file
        if (!alive || !current || saving) return
        // Mismo contenido: solo puede haber cambiado contra qué se compara (preparar o hacer commit)
        if (f.version === current.version) return setFile({ ...current, baseline: f.baseline, missing: f.missing })
        if (live.current.dirty) return setExternal(f)
        const ta = input.current
        const selection = ta ? [ta.selectionStart, ta.selectionEnd] : null
        adopt(f, toLf(f.content))
        if (selection) requestAnimationFrame(() => input.current?.setSelectionRange(selection[0], selection[1]))
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [version])

  const lines = useMemo(() => text.split('\n'), [text])
  const unit = useMemo(() => detectIndent(original || text), [original])
  const highlighted = useMemo(() => {
    const language = text.length > HIGHLIGHT_LIMIT ? null : lang
    // El espacio final hace que la última línea, aunque esté vacía, ocupe su altura
    return lines.map((line) => highlightCode(line, language)).join('\n') + ' '
  }, [lines, lang])

  // Las marcas del margen pueden ir un instante por detrás del texto
  const deferred = useDeferredValue(text)
  const baseline = useMemo(() => (file?.baseline == null ? null : toLf(file.baseline)), [file?.baseline])
  const marks = useMemo(() => (baseline === null ? null : lineMarks(baseline, deferred)), [baseline, deferred])
  const gutter = useMemo(() => {
    let html = ''
    for (let i = 0; i < lines.length; i++) {
      const mark = marks?.marks[i]
      const deleted = marks?.deletedBefore.has(i) ? ' del-before' : i === lines.length - 1 && marks?.deletedBefore.has(lines.length) ? ' del-after' : ''
      html += `<div class="fe-ln${mark ? ` ${mark}` : ''}${deleted}">${i + 1}</div>`
    }
    return html
  }, [lines.length, marks])

  useEffect(() => {
    const probe = document.createElement('span')
    probe.className = 'fe-probe'
    probe.textContent = 'x'.repeat(100)
    document.body.appendChild(probe)
    charWidth.current = probe.getBoundingClientRect().width / 100 || charWidth.current
    probe.remove()
  }, [])

  /** Mantiene visible la línea del cursor (y, en horizontal, su columna) */
  const reveal = (line: number, column: number, value: string, center = false): void => {
    const box = scroller.current
    if (!box) return
    const top = PAD_TOP + (line - 1) * LINE_HEIGHT
    if (center) box.scrollTop = top - box.clientHeight / 2
    else if (top < box.scrollTop) box.scrollTop = top - LINE_HEIGHT
    else if (top + LINE_HEIGHT > box.scrollTop + box.clientHeight) box.scrollTop = top + 2 * LINE_HEIGHT - box.clientHeight
    const start = offsetOfLine(value, line)
    const before = value.slice(start, start + column - 1)
    const visual = before.length + (before.split('\t').length - 1) * 3
    const gutterWidth = box.querySelector<HTMLElement>('.fe-gutter')?.offsetWidth ?? 0
    const x = 12 + visual * charWidth.current
    const visible = box.clientWidth - gutterWidth
    if (x < box.scrollLeft + 24) box.scrollLeft = Math.max(0, x - 48)
    else if (x > box.scrollLeft + visible - 32) box.scrollLeft = x - visible + 64
  }

  const syncCaret = (center = false): void => {
    const ta = input.current
    if (!ta) return
    const position = lineColumn(ta.value, ta.selectionDirection === 'backward' ? ta.selectionStart : ta.selectionEnd)
    setCaret(position)
    reveal(position.line, position.column, ta.value, center)
  }

  const focusLine = (line: number, value = input.current?.value ?? ''): void => {
    const ta = input.current
    if (!ta) return
    const at = offsetOfLine(value, line)
    ta.focus({ preventScroll: true })
    ta.setSelectionRange(at, at)
    syncCaret(true)
  }

  const applyEdit = (ta: HTMLTextAreaElement, edit: TextEdit | null): void => {
    if (!edit) return
    ta.setSelectionRange(edit.from, edit.to)
    // execCommand mantiene el deshacer nativo (⌘Z) del textarea
    if (!document.execCommand(edit.text ? 'insertText' : 'delete', false, edit.text)) {
      ta.setRangeText(edit.text, edit.from, edit.to, 'end')
      setText(ta.value)
    }
    ta.setSelectionRange(edit.selectionStart, edit.selectionEnd)
    syncCaret()
  }

  const goToLine = async (): Promise<void> => {
    const result = await prompt({
      title: 'Ir a la línea',
      label: `Número de línea (1 a ${lines.length})`,
      initial: String(caret.line),
      confirmLabel: 'Ir',
      validate: (value) => (/^\d+$/.test(value) && Number(value) >= 1 ? null : 'Escribe un número de línea')
    })
    if (result) focusLine(Math.min(Number(result.value), lines.length))
    else input.current?.focus()
  }

  const save = async (stageAfter = false, force = false): Promise<void> => {
    if (!file) return
    setSaving(true)
    try {
      const content = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text
      const result = await api.writeEditable(repo, path, target, content, file.version, force)
      if (!result.ok) {
        const ok = await api.confirm({
          message: target === 'working' ? `${path} cambió en disco desde que lo abriste` : `La versión preparada de ${path} cambió desde que la abriste`,
          detail: 'Si continúas, se reemplaza por lo que tienes en el editor.',
          confirmLabel: 'Reemplazar',
          destructive: true
        })
        if (ok) await save(stageAfter, true)
        return
      }
      if (stageAfter) await api.stage(repo, [path])
      setFile({ ...file, content, version: result.version, missing: false, proposed: undefined })
      setOriginal(text)
      setExternal(null)
      setFromRev(false)
      drafts.delete(key)
      onSaved(target, stageAfter)
    } catch (e) {
      toast('error', 'No se pudo guardar', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  /** Atajos propios del editor; el resto de atajos de la app no deben dispararse mientras se escribe */
  const editorShortcut = (e: KeyboardEvent): boolean => {
    const cmd = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    if (cmd && !e.shiftKey && k === 's') {
      e.preventDefault()
      if (dirty && !saving) void save()
      return true
    }
    if (cmd && !e.shiftKey && k === 'g') {
      e.preventDefault()
      void goToLine()
      return true
    }
    return false
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    const cmd = e.metaKey || e.ctrlKey
    // La paleta de comandos sigue a mano
    if (cmd && !e.shiftKey && e.key.toLowerCase() === 'p') return
    e.stopPropagation()
    if (editorShortcut(e)) return
    if (e.key === 'Escape') return e.preventDefault(), onClose()
    if (e.nativeEvent.isComposing || cmd || e.altKey) return
    const ta = e.currentTarget
    if (e.key === 'Tab') {
      e.preventDefault()
      applyEdit(ta, indentEdit(ta.value, ta.selectionStart, ta.selectionEnd, unit, e.shiftKey))
    } else if (e.key === 'Enter' && !e.shiftKey) {
      const edit = newlineEdit(ta.value, ta.selectionStart, ta.selectionEnd)
      if (edit) {
        e.preventDefault()
        applyEdit(ta, edit)
      }
    }
  }

  /** Clic en el número de línea: selecciona la línea entera (con Mayús, hasta ella) */
  const selectFromGutter = (e: MouseEvent<HTMLDivElement>): void => {
    const ta = input.current
    if (!ta) return
    e.preventDefault()
    const line = Math.max(1, Math.min(lines.length, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top - PAD_TOP) / LINE_HEIGHT) + 1))
    const start = offsetOfLine(ta.value, line)
    const end = line < lines.length ? offsetOfLine(ta.value, line + 1) : ta.value.length
    ta.focus({ preventScroll: true })
    if (e.shiftKey) ta.setSelectionRange(Math.min(ta.selectionStart, start), Math.max(ta.selectionEnd, end))
    else ta.setSelectionRange(start, end)
    syncCaret()
  }

  const against = target === 'working' ? 'lo preparado' : 'el último commit'
  const versus = target === 'working' ? 'respecto a lo preparado' : 'respecto al último commit'
  const indentLabel = unit === '\t' ? 'Tabuladores' : `${unit.length} espacios`

  return (
    <div className="file-tool file-editor" onKeyDown={(e) => editorShortcut(e) && e.stopPropagation()}>
      <div className="diff-toolbar">
        <Icon.Edit size={15} />
        <FilePath path={path} />
        <span className={`diff-source ${target === 'index' ? 'fe-target-index' : ''}`}>{target === 'working' ? 'Archivo de trabajo' : 'Versión preparada'}</span>
        {dirty && <span className="fe-dirty" title="Cambios sin guardar">●</span>}
        <span className="spacer" />
        <div className="segmented" title="Qué versión editas">
          <button className={target === 'working' ? 'active' : ''} onClick={() => target !== 'working' && onSwitch('working')}>Archivo</button>
          <button className={target === 'index' ? 'active' : ''} onClick={() => target !== 'index' && onSwitch('index')}>Preparado</button>
        </div>
        <button className="icon-btn" disabled={!dirty || saving} onClick={() => (setText(original), input.current?.focus())} title={`Descartar lo editado y volver a ${target === 'working' ? 'lo guardado en disco' : 'la versión preparada'}`}>
          <Icon.Undo size={15} />
        </button>
        {target === 'working' ? (
          <>
            <button className="btn btn-sm" disabled={!file || !dirty || saving} onClick={() => void save()} title="Guarda el archivo (⌘S)">Guardar</button>
            <button className="btn btn-sm btn-stage" disabled={!file || saving} onClick={() => void save(true)} title="Guarda el archivo y lo prepara entero">Guardar y preparar</button>
          </>
        ) : (
          <button className="btn btn-sm btn-stage" disabled={!file || !dirty || saving} onClick={() => void save()} title="Esto es lo que entrará en el commit (⌘S)">
            {saving ? 'Preparando…' : 'Preparar esta versión'}
          </button>
        )}
        <button className="icon-btn" title="Cerrar (Esc)" onClick={onClose}><Icon.Close size={15} /></button>
      </div>

      {target === 'index' && file && (
        <div className="diff-hint fe-hint">
          {patch ? 'Partes de la versión preparada más las líneas que elegiste. ' : ''}
          Lo que prepares aquí es lo que entra en el commit; el archivo en disco no cambia.
        </div>
      )}
      {fromRev && file && (
        <div className="diff-hint fe-hint">
          Partes de {path} tal como estaba en <span className="mono">{request.revLabel ?? rev?.slice(0, 7)}</span>. Al guardar se escribe en tu archivo y queda en <em>Sin preparar</em>, como cualquier cambio.
          {!file.missing && toLf(file.content) !== toLf(file.baseline ?? '') && (
            <span className="warn-text"> Tu archivo tiene cambios sin preparar: al guardar se reemplazan por esta versión.</span>
          )}
        </div>
      )}
      {restored && <div className="diff-hint">Se recuperaron los cambios sin guardar de la última vez.</div>}
      {external && (
        <div className="fe-banner">
          <Icon.Warning size={14} />
          <span>{target === 'working' ? 'El archivo cambió en disco' : 'La versión preparada cambió'} mientras lo editabas.</span>
          <span className="spacer" />
          <button className="btn btn-xs" onClick={() => adopt(external, toLf(external.content))}>Recargar y perder mis cambios</button>
          <button className="btn btn-xs" onClick={() => (setFile({ ...external, content: file?.content ?? external.content }), setExternal(null))}>Mantener los míos</button>
        </div>
      )}

      {error && <div className="empty">{error}</div>}
      {!file && !error && <div className="empty">Cargando…</div>}
      {file && (
        <>
          <div className="fe-scroll" ref={scroller}>
            <div className="fe-grid">
              <div className="fe-gutter" aria-hidden onMouseDown={selectFromGutter} dangerouslySetInnerHTML={{ __html: gutter }} />
              <div className="fe-code">
                <div className="fe-current" style={{ top: PAD_TOP + (caret.line - 1) * LINE_HEIGHT }} />
                <pre className="fe-highlight" aria-hidden dangerouslySetInnerHTML={{ __html: highlighted }} />
                <textarea
                  ref={input}
                  className="fe-input"
                  value={text}
                  wrap="off"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label={`Contenido de ${path}`}
                  onChange={(e) => setText(e.target.value)}
                  onSelect={() => syncCaret()}
                  onKeyDown={onKeyDown}
                />
              </div>
            </div>
          </div>
          <div className="fe-status">
            <span>Lín {caret.line}, col {caret.column}</span>
            <span>{lines.length.toLocaleString('es')} líneas</span>
            {marks && (marks.added || marks.removed) ? (
              <span title={`Diferencia con ${against}`}>
                <span className="ok-text">+{marks.added}</span> <span className="danger-text">−{marks.removed}</span> {versus}
              </span>
            ) : marks ? <span>Igual que {against}</span> : <span>Archivo nuevo</span>}
            <span className="spacer" />
            <span>{indentLabel}</span>
            <span>{eol === '\r\n' ? 'CRLF' : 'LF'}</span>
            <span>{lang ?? 'Texto'}</span>
            <span className="muted">⌘S guardar · ⌘G ir a línea · Esc cerrar</span>
          </div>
        </>
      )}
    </div>
  )
}
