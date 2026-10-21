export type LineOp = '=' | '-' | '+'

/** Más allá de estas diferencias el cálculo exacto no compensa: el tramo del medio cuenta entero como cambiado */
const MAX_EDITS = 1000

/**
 * Diff de líneas de Myers: la secuencia más corta de líneas que se quedan (=), se borran (-) o se añaden (+)
 * para pasar de `a` a `b`. Recorta antes el principio y el final comunes, que en una edición son casi todo.
 */
export function diffLines(a: string[], b: string[]): LineOp[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) endA--, endB--
  const middle = myers(a.slice(start, endA), b.slice(start, endB)) ?? [...Array<LineOp>(endA - start).fill('-'), ...Array<LineOp>(endB - start).fill('+')]
  return [...Array<LineOp>(start).fill('='), ...middle, ...Array<LineOp>(a.length - endA).fill('=')]
}

function myers(a: string[], b: string[]): LineOp[] | null {
  const n = a.length
  const m = b.length
  const limit = Math.min(n + m, MAX_EDITS)
  const off = limit + 1
  let v = new Int32Array(2 * limit + 3)
  const trace: Int32Array[] = []
  for (let d = 0; d <= limit; d++) {
    trace.push(v)
    v = v.slice()
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) x++, y++
      v[off + k] = x
      if (x >= n && y >= m) return backtrack(trace, n, m, off)
    }
  }
  return null
}

function backtrack(trace: Int32Array[], n: number, m: number, off: number): LineOp[] {
  const ops: LineOp[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]
    const k = x - y
    const prevK = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? k + 1 : k - 1
    const prevX = d === 0 ? 0 : v[off + prevK]
    const prevY = d === 0 ? 0 : prevX - prevK
    while (x > prevX && y > prevY) ops.push('='), x--, y--
    if (d > 0) ops.push(x === prevX ? '+' : '-')
    x = prevX
    y = prevY
  }
  return ops.reverse()
}

export type LineMark = 'add' | 'mod' | null

export interface LineMarks {
  /** Una marca por línea del texto nuevo */
  marks: LineMark[]
  /** Líneas del texto nuevo justo antes de las cuales se borraron líneas (puede ser igual al total: al final) */
  deletedBefore: Set<number>
  added: number
  removed: number
}

/** Marcas del margen de un editor: líneas añadidas, cambiadas y dónde se borraron, respecto a `baseline` */
export function lineMarks(baseline: string, text: string): LineMarks {
  const before = baseline.split('\n')
  const after = text.split('\n')
  const ops = diffLines(before, after)
  const marks: LineMark[] = new Array(after.length).fill(null)
  const deletedBefore = new Set<number>()
  let added = 0
  let removed = 0
  let line = 0
  for (let i = 0; i < ops.length; ) {
    if (ops[i] === '=') {
      line++
      i++
      continue
    }
    // Un tramo de cambios: las primeras líneas añadidas reemplazan a las borradas (cambiadas), el resto son nuevas
    let dels = 0
    const first = line
    while (i < ops.length && ops[i] !== '=') {
      if (ops[i] === '-') dels++
      else line++
      i++
    }
    const ins = line - first
    for (let j = 0; j < ins; j++) marks[first + j] = j < dels ? 'mod' : 'add'
    if (dels > 0 && ins === 0) deletedBefore.add(first)
    added += ins
    removed += dels
  }
  return { marks, deletedBefore, added, removed }
}
