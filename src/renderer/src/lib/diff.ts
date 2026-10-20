export type LineType = ' ' | '+' | '-' | '\\'

export interface DiffLine {
  type: LineType
  text: string
  oldNo?: number
  newNo?: number
}

export interface Hunk {
  header: string
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

export interface DiffFile {
  headerLines: string[]
  oldPath: string | null
  newPath: string | null
  binary: boolean
  isNew: boolean
  isDeleted: boolean
  isRename: boolean
  /** Diff combinado (`diff --cc`), típico de conflictos: solo lectura */
  combined: boolean
  hunks: Hunk[]
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

function stripPrefix(path: string): string | null {
  if (path === '/dev/null') return null
  return path.replace(/^[ab]\//, '')
}

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  let file: DiffFile | null = null
  let hunk: Hunk | null = null
  let oldNo = 0
  let newNo = 0

  for (const line of lines) {
    if (line.startsWith('diff --git ') || line.startsWith('diff --cc ') || line.startsWith('diff --combined ')) {
      file = {
        headerLines: [line],
        oldPath: null,
        newPath: null,
        binary: false,
        isNew: false,
        isDeleted: false,
        isRename: false,
        combined: !line.startsWith('diff --git '),
        hunks: []
      }
      files.push(file)
      hunk = null
      continue
    }
    if (!file) continue

    if (hunk && !file.combined) {
      const type = line[0]
      if (type === ' ' || type === '+' || type === '-' || type === '\\') {
        const entry: DiffLine = { type, text: line.slice(1) }
        if (type === ' ') {
          entry.oldNo = oldNo++
          entry.newNo = newNo++
        } else if (type === '-') {
          entry.oldNo = oldNo++
        } else if (type === '+') {
          entry.newNo = newNo++
        }
        hunk.lines.push(entry)
        continue
      }
      if (line === '') {
        // Algunas herramientas recortan el espacio de las líneas de contexto vacías
        hunk.lines.push({ type: ' ', text: '', oldNo: oldNo++, newNo: newNo++ })
        continue
      }
    }

    const match = HUNK_RE.exec(line)
    if (match && !file.combined) {
      hunk = {
        header: line,
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: []
      }
      oldNo = hunk.oldStart
      newNo = hunk.newStart
      file.hunks.push(hunk)
      continue
    }

    if (file.hunks.length === 0) {
      file.headerLines.push(line)
      if (line.startsWith('--- ')) file.oldPath = stripPrefix(line.slice(4))
      else if (line.startsWith('+++ ')) file.newPath = stripPrefix(line.slice(4))
      else if (line.startsWith('new file mode')) file.isNew = true
      else if (line.startsWith('deleted file mode')) file.isDeleted = true
      else if (line.startsWith('rename from') || line.startsWith('copy from')) file.isRename = true
      else if (line.startsWith('Binary files') || line === 'GIT binary patch') file.binary = true
    }
  }
  return files
}

/** Marca el tramo que cambió dentro de una línea modificada (prefijo y sufijo comunes). */
export function intraline(oldText: string, newText: string): { old: [number, number]; new: [number, number] } | null {
  if (oldText === newText) return null
  let start = 0
  const max = Math.min(oldText.length, newText.length)
  while (start < max && oldText[start] === newText[start]) start++
  let endOld = oldText.length
  let endNew = newText.length
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--
    endNew--
  }
  // Si casi toda la línea cambió, resaltar no aporta nada
  const changed = Math.max(endOld - start, endNew - start)
  if (changed > Math.max(oldText.length, newText.length) * 0.8) return null
  return { old: [start, endOld], new: [start, endNew] }
}

export interface SplitRow {
  left?: { line: DiffLine; index: number }
  right?: { line: DiffLine; index: number }
}

/** Empareja líneas eliminadas y añadidas consecutivas para la vista dividida. */
export function toSplitRows(hunk: Hunk): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0
  const lines = hunk.lines
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === ' ') {
      rows.push({ left: { line, index: i }, right: { line, index: i } })
      i++
      continue
    }
    if (line.type === '\\') {
      i++
      continue
    }
    const removed: { line: DiffLine; index: number }[] = []
    const added: { line: DiffLine; index: number }[] = []
    while (i < lines.length && (lines[i].type === '-' || lines[i].type === '\\')) {
      if (lines[i].type === '-') removed.push({ line: lines[i], index: i })
      i++
    }
    while (i < lines.length && (lines[i].type === '+' || lines[i].type === '\\')) {
      if (lines[i].type === '+') added.push({ line: lines[i], index: i })
      i++
    }
    const count = Math.max(removed.length, added.length)
    for (let k = 0; k < count; k++) rows.push({ left: removed[k], right: added[k] })
  }
  return rows
}

/** Para cada línea, la línea con la que se compara en el resaltado intralínea. */
export function pairChangedLines(hunk: Hunk): Map<number, number> {
  const pairs = new Map<number, number>()
  for (const row of toSplitRows(hunk)) {
    if (row.left && row.right && row.left.index !== row.right.index) {
      pairs.set(row.left.index, row.right.index)
      pairs.set(row.right.index, row.left.index)
    }
  }
  return pairs
}
