import type { DiffFile, Hunk } from './diff'

/** Un bloque del diff y las líneas elegidas en él (null = el bloque entero) */
export interface HunkPick {
  hunk: number
  lines: Set<number> | null
}

interface HunkBody {
  lines: string[]
  oldCount: number
  newCount: number
  changes: number
}

/**
 * Cuerpo de un hunk, opcionalmente restringido a algunas líneas.
 *
 * - `reverse = false` (preparar): el parche se aplica sobre el índice, que es el
 *   lado "antiguo". Las líneas `-` no elegidas pasan a ser contexto y las `+` no
 *   elegidas desaparecen.
 * - `reverse = true` (quitar del índice o descartar): el parche se aplica al revés
 *   sobre el lado "nuevo", así que es al contrario.
 *
 * Así el lado sobre el que se aplica queda intacto (su número de línea inicial sigue
 * valiendo) y varios hunks pueden ir en un mismo parche.
 */
function hunkBody(hunk: Hunk, selected: Set<number> | null, reverse: boolean): HunkBody {
  const body: string[] = []
  let oldCount = 0
  let newCount = 0
  let changes = 0
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
      changes++
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

  // Un lado con líneas no puede empezar en la 0 (pasa al convertir un archivo nuevo en un cambio de contenido)
  const start = (line: number, count: number): number => (count > 0 && line === 0 ? 1 : line)
  const header = `@@ -${start(hunk.oldStart, oldCount)},${oldCount} +${start(hunk.newStart, newCount)},${newCount} @@`
  return { lines: [header, ...body], oldCount, newCount, changes }
}

/**
 * Cabecera del parche. Un parche parcial de un archivo nuevo, borrado o renombrado ya no lo crea,
 * lo borra ni lo renombra entero: se convierte en un cambio de contenido sobre la ruta que existe
 * donde se aplica. Por ejemplo, quitar unas líneas de un archivo nuevo preparado lo deja preparado
 * sin ellas, y quitar líneas de un renombrado no deshace el renombre.
 * Los cambios de permisos (`old mode` / `new mode`) solo viajan con el archivo entero.
 */
function patchHeader(file: DiffFile, oldEmpty: boolean, newEmpty: boolean): string[] {
  const keepsWhole = (file.isNew && oldEmpty) || (file.isDeleted && newEmpty)
  if (keepsWhole) return file.headerLines
  if (!file.isNew && !file.isDeleted && !file.isRename) return file.headerLines.filter((l) => !/^(old|new) mode /.test(l))
  const side = file.headerLines.find((l) => l.startsWith(file.isDeleted ? '--- ' : '+++ '))?.slice(4)
  const path = side ?? `b/${file.newPath ?? file.oldPath}`
  const a = path.replace(/^("?)[ab]\//, '$1a/')
  const b = path.replace(/^("?)[ab]\//, '$1b/')
  return [`diff --git ${a} ${b}`, `--- ${a}`, `+++ ${b}`]
}

/** Parche con varios bloques (y, en cada uno, solo las líneas elegidas). Vacío si no hay nada que aplicar. */
export function buildPatch(file: DiffFile, picks: HunkPick[], reverse: boolean): string {
  const bodies = [...picks]
    .sort((x, y) => x.hunk - y.hunk)
    .map((pick) => hunkBody(file.hunks[pick.hunk], pick.lines, reverse))
    .filter((body) => body.changes > 0)
  if (!bodies.length) return ''
  const header = patchHeader(file, bodies.every((b) => b.oldCount === 0), bodies.every((b) => b.newCount === 0))
  return [...header, ...bodies.flatMap((b) => b.lines)].join('\n') + '\n'
}

/** Parche de un solo bloque. `git apply --recount` recalcula los totales, pero los dejamos correctos igual. */
export function buildHunkPatch(file: DiffFile, hunk: Hunk, selected: Set<number> | null, reverse: boolean): string {
  const index = file.hunks.indexOf(hunk)
  return buildPatch(index === -1 ? { ...file, hunks: [hunk] } : file, [{ hunk: index === -1 ? 0 : index, lines: selected }], reverse)
}

/** Se puede preparar por partes cualquier archivo de texto con cambios (también nuevo, borrado o renombrado). */
export function supportsPartialStaging(file: DiffFile): boolean {
  return !file.binary && !file.combined && file.hunks.length > 0
}

export function hasChanges(hunk: Hunk, selected: Set<number> | null): boolean {
  return hunk.lines.some((line, i) => (line.type === '+' || line.type === '-') && (selected === null || selected.has(i)))
}
