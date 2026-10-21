/** Unidad de sangría del archivo: tabulador si la mayoría de líneas sangradas lo usan; si no, el menor salto de espacios habitual (2 o 4) */
export function detectIndent(text: string): string {
  let tabs = 0
  let spaced = 0
  const steps = new Map<number, number>()
  let previous = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const lead = /^[ \t]*/.exec(line)![0]
    if (lead.startsWith('\t')) tabs++
    else if (lead) spaced++
    const width = lead.startsWith('\t') ? 0 : lead.length
    const step = Math.abs(width - previous)
    if (step === 2 || step === 4) steps.set(step, (steps.get(step) ?? 0) + 1)
    previous = width
  }
  if (tabs > spaced) return '\t'
  return (steps.get(4) ?? 0) > (steps.get(2) ?? 0) ? '    ' : '  '
}

/** Final de línea del archivo: CRLF si la mayoría de líneas lo usan */
export function detectEol(text: string): '\n' | '\r\n' {
  const crlf = text.split('\r\n').length - 1
  const lf = text.split('\n').length - 1 - crlf
  return crlf > lf ? '\r\n' : '\n'
}

export interface TextEdit {
  /** Tramo de `value` que se reemplaza */
  from: number
  to: number
  text: string
  /** Selección después del cambio */
  selectionStart: number
  selectionEnd: number
}

function outdentLine(line: string, unit: string): string {
  if (line.startsWith('\t')) return line.slice(1)
  const width = unit === '\t' ? 4 : unit.length
  let n = 0
  while (n < width && line[n] === ' ') n++
  return line.slice(n)
}

/**
 * Tabulador sobre una selección. Sin saltos de línea y sin Mayús, inserta la sangría en el cursor;
 * si abarca varias líneas (o con Mayús), sangra o quita sangría a las líneas completas y las deja seleccionadas.
 * Devuelve null si no cambia nada.
 */
export function indentEdit(value: string, start: number, end: number, unit: string, outdent: boolean): TextEdit | null {
  const multiline = value.slice(start, end).includes('\n')
  if (!multiline && !outdent) {
    return { from: start, to: end, text: unit, selectionStart: start + unit.length, selectionEnd: start + unit.length }
  }
  const from = value.lastIndexOf('\n', start - 1) + 1
  // Si la selección acaba al principio de una línea, esa línea no cuenta
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const lineEnd = value.indexOf('\n', last)
  const to = lineEnd === -1 ? value.length : lineEnd
  const original = value.slice(from, to)
  const lines = original.split('\n').map((line) => (outdent ? outdentLine(line, unit) : line ? unit + line : line))
  const text = lines.join('\n')
  if (text === original) return null
  if (!multiline) {
    // Mayús+Tab con el cursor en una línea: el cursor se mueve con el texto
    const shift = original.length - text.length
    const caret = Math.max(from, start - shift)
    return { from, to, text, selectionStart: caret, selectionEnd: Math.max(from, end - shift) }
  }
  return { from, to, text, selectionStart: from, selectionEnd: from + text.length }
}

/** Enter: salto de línea con la misma sangría que la línea actual (o null si no tiene sangría) */
export function newlineEdit(value: string, start: number, end: number): TextEdit | null {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const indent = /^[ \t]*/.exec(value.slice(lineStart, start))![0]
  if (!indent) return null
  const text = `\n${indent}`
  return { from: start, to: end, text, selectionStart: start + text.length, selectionEnd: start + text.length }
}

/** Línea y columna (desde 1) de una posición del texto */
export function lineColumn(value: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0
  for (let i = value.indexOf('\n'); i !== -1 && i < offset; i = value.indexOf('\n', i + 1)) {
    line++
    lineStart = i + 1
  }
  return { line, column: offset - lineStart + 1 }
}

/** Posición del principio de la línea `line` (desde 1); más allá del final, el final del texto */
export function offsetOfLine(value: string, line: number): number {
  let offset = 0
  for (let n = 1; n < line; n++) {
    const next = value.indexOf('\n', offset)
    if (next === -1) return value.length
    offset = next + 1
  }
  return offset
}
