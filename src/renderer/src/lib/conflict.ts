/** Lado que se incluye en el resultado de un conflicto */
export type Side = 'ours' | 'theirs'

export type Segment =
  | { kind: 'common'; lines: string[] }
  | { kind: 'conflict'; index: number; ours: string[]; base: string[] | null; theirs: string[]; oursLabel: string; theirsLabel: string }

export interface ParsedConflict {
  segments: Segment[]
  conflicts: number
  /** El archivo terminaba en salto de línea */
  trailingNewline: boolean
  eol: '\n' | '\r\n'
}

/** null = sin resolver; [] = ninguno de los dos; ['ours','theirs'] = ambos, en ese orden */
export type Choice = Side[] | null

const marker = (line: string, char: string): string | null => {
  const clean = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!clean.startsWith(char.repeat(7))) return null
  const rest = clean.slice(7)
  if (rest !== '' && !rest.startsWith(' ')) return null
  return rest.trim()
}

function splitLines(text: string): { lines: string[]; trailingNewline: boolean; eol: '\n' | '\r\n' } {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const trailingNewline = text.endsWith('\n')
  const body = trailingNewline ? text.slice(0, text.endsWith('\r\n') ? -2 : -1) : text
  return { lines: body === '' && trailingNewline ? [''] : body.split(eol), trailingNewline, eol }
}

/**
 * Divide un archivo con marcadores de conflicto (estilos merge y diff3) en tramos comunes y conflictos.
 * Devuelve null si los marcadores están incompletos o anidados.
 */
export function parseConflicts(text: string): ParsedConflict | null {
  const { lines, trailingNewline, eol } = splitLines(text)
  const segments: Segment[] = []
  let common: string[] = []
  let conflicts = 0
  let i = 0
  while (i < lines.length) {
    const start = marker(lines[i], '<')
    if (start === null) {
      common.push(lines[i++])
      continue
    }
    const ours: string[] = []
    let base: string[] | null = null
    const theirs: string[] = []
    let section: 'ours' | 'base' | 'theirs' = 'ours'
    let theirsLabel: string | null = null
    i++
    for (; i < lines.length; i++) {
      const line = lines[i]
      if (marker(line, '<') !== null) return null
      if (section === 'ours' && marker(line, '|') !== null) {
        section = 'base'
        base = []
      } else if (section !== 'theirs' && marker(line, '=') === '') section = 'theirs'
      else if (section === 'theirs' && marker(line, '>') !== null) {
        theirsLabel = marker(line, '>')
        break
      } else (section === 'ours' ? ours : section === 'base' ? base! : theirs).push(line)
    }
    if (theirsLabel === null) return null
    i++
    if (common.length) segments.push({ kind: 'common', lines: common })
    common = []
    segments.push({ kind: 'conflict', index: conflicts++, ours, base, theirs, oursLabel: start, theirsLabel })
  }
  if (common.length) segments.push({ kind: 'common', lines: common })
  return { segments, conflicts, trailingNewline, eol }
}

/** Cuando git no dejó marcadores (por ejemplo, un lado borró el archivo): un único conflicto con las dos versiones enteras. */
export function wholeFileConflict(ours: string | null, theirs: string | null, base: string | null): ParsedConflict {
  const toLines = (text: string | null): string[] => (text === null || text === '' ? [] : splitLines(text).lines)
  return {
    segments: [{ kind: 'conflict', index: 0, ours: toLines(ours), base: base === null ? null : toLines(base), theirs: toLines(theirs), oursLabel: 'HEAD', theirsLabel: 'entrante' }],
    conflicts: 1,
    trailingNewline: true,
    eol: (ours ?? theirs ?? '').includes('\r\n') ? '\r\n' : '\n'
  }
}

export interface ResultLine {
  text: string
  /** De dónde sale la línea; 'pending' = marcador de un conflicto sin resolver */
  from: 'common' | Side | 'pending'
  conflict?: number
}

/** Líneas del resultado: los conflictos sin resolver se dejan con sus marcadores. */
export function resultLines(parsed: ParsedConflict, choices: Choice[]): ResultLine[] {
  const out: ResultLine[] = []
  for (const seg of parsed.segments) {
    if (seg.kind === 'common') {
      for (const text of seg.lines) out.push({ text, from: 'common' })
      continue
    }
    const choice = choices[seg.index] ?? null
    if (choice === null) {
      out.push({ text: `<<<<<<< ${seg.oursLabel}`.trimEnd(), from: 'pending', conflict: seg.index })
      for (const text of seg.ours) out.push({ text, from: 'pending', conflict: seg.index })
      out.push({ text: '=======', from: 'pending', conflict: seg.index })
      for (const text of seg.theirs) out.push({ text, from: 'pending', conflict: seg.index })
      out.push({ text: `>>>>>>> ${seg.theirsLabel}`.trimEnd(), from: 'pending', conflict: seg.index })
      continue
    }
    for (const side of choice) for (const text of seg[side]) out.push({ text, from: side, conflict: seg.index })
  }
  return out
}

export function joinResult(parsed: ParsedConflict, lines: string[]): string {
  if (lines.length === 0) return ''
  return lines.join(parsed.eol) + (parsed.trailingNewline ? parsed.eol : '')
}

/** Marca o desmarca un lado; al marcar se añade al final, así el orden de los clics decide el orden del resultado. */
export function toggleSide(choice: Choice, side: Side): Choice {
  const current = choice ?? []
  if (current.includes(side)) {
    const next = current.filter((s) => s !== side)
    return next.length ? next : null
  }
  return [...current, side]
}

export const hasMarkers = (text: string): boolean => /^(<{7}|={7}|>{7})( |$)/m.test(text)
