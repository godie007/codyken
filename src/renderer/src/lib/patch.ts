import type { DiffFile, Hunk } from './diff'

/**
 * Construye un parche con un solo hunk, opcionalmente restringido a algunas líneas.
 *
 * - `reverse = false` (preparar): el parche se aplica sobre el índice, que es el
 *   lado "antiguo". Las líneas `-` no elegidas pasan a ser contexto y las `+` no
 *   elegidas desaparecen.
 * - `reverse = true` (quitar del índice o descartar): el parche se aplica al revés
 *   sobre el lado "nuevo", así que es al contrario.
 *
 * `git apply --recount` recalcula los totales, pero los dejamos correctos igual.
 */
export function buildHunkPatch(file: DiffFile, hunk: Hunk, selected: Set<number> | null, reverse: boolean): string {
  const body: string[] = []
  let oldCount = 0
  let newCount = 0
  let lastKept = false

  hunk.lines.forEach((line, index) => {
    const chosen = selected === null || selected.has(index)
    if (line.type === '\\') {
      if (lastKept) body.push('\\' + line.text)
      return
    }
    if (line.type === ' ') {
      body.push(' ' + line.text)
      oldCount++
      newCount++
      lastKept = true
      return
    }
    if (chosen) {
      body.push(line.type + line.text)
      if (line.type === '-') oldCount++
      else newCount++
      lastKept = true
      return
    }
    const becomesContext = reverse ? line.type === '+' : line.type === '-'
    if (becomesContext) {
      body.push(' ' + line.text)
      oldCount++
      newCount++
      lastKept = true
    } else {
      lastKept = false
    }
  })

  const hunkHeader = `@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`
  return [...file.headerLines, hunkHeader, ...body].join('\n') + '\n'
}

/** Solo se permite preparar por partes un archivo modificado normal (no nuevo, borrado, renombrado ni binario). */
export function supportsPartialStaging(file: DiffFile): boolean {
  return !file.binary && !file.combined && !file.isNew && !file.isDeleted && !file.isRename && file.hunks.length > 0
}

export function hasChanges(hunk: Hunk, selected: Set<number> | null): boolean {
  return hunk.lines.some((line, i) => (line.type === '+' || line.type === '-') && (selected === null || selected.has(i)))
}
