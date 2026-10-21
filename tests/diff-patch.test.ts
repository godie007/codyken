import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseNameStatus, parseStatus } from '../src/main/git'
import { intraline, parseDiff, toSplitRows } from '../src/renderer/src/lib/diff'
import { buildHunkPatch, buildPatch, supportsPartialStaging } from '../src/renderer/src/lib/patch'

let dir = ''
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8', input: '' })
const apply = (patch: string, ...flags: string[]): string =>
  execFileSync('git', ['apply', '--recount', ...flags, '-'], { cwd: dir, encoding: 'utf8', input: patch })

const ORIGINAL = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'].join('\n') + '\n'

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'codyken-test-'))
  git('init', '-q')
  git('config', 'user.email', 'test@codyken.local')
  git('config', 'user.name', 'Test')
  writeFileSync(join(dir, 'a.txt'), ORIGINAL)
  git('add', '.')
  git('commit', '-qm', 'inicio')
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('parseDiff', () => {
  it('lee hunks y numera líneas', () => {
    writeFileSync(join(dir, 'a.txt'), ORIGINAL.replace('dos', 'DOS').replace('nueve\n', 'nueve\nnueve y medio\n'))
    const [file] = parseDiff(git('diff', '-U1', '--', 'a.txt'))
    expect(file.newPath).toBe('a.txt')
    expect(file.hunks).toHaveLength(2)
    const first = file.hunks[0]
    expect(first.lines.map((l) => l.type).join('')).toBe(' -+ ')
    expect(first.lines[1]).toMatchObject({ type: '-', text: 'dos', oldNo: 2 })
    expect(first.lines[2]).toMatchObject({ type: '+', text: 'DOS', newNo: 2 })
    expect(supportsPartialStaging(file)).toBe(true)
    git('checkout', '--', 'a.txt')
  })

  it('reconoce archivos binarios y nuevos', () => {
    const [file] = parseDiff('diff --git a/x.png b/x.png\nnew file mode 100644\nindex 0000000..abc\nBinary files /dev/null and b/x.png differ\n')
    expect(file.binary).toBe(true)
    expect(file.isNew).toBe(true)
    expect(supportsPartialStaging(file)).toBe(false)
  })

  it('empareja líneas en la vista dividida', () => {
    const [file] = parseDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n')
    const rows = toSplitRows(file.hunks[0])
    expect(rows).toHaveLength(3)
    expect(rows[1].left?.line.text).toBe('b')
    expect(rows[1].right?.line.text).toBe('B')
  })
})

describe('intraline', () => {
  it('resalta solo el tramo cambiado', () => {
    expect(intraline('const valor = 10', 'const valor = 25')).toEqual({ old: [14, 16], new: [14, 16] })
    expect(intraline('abc', 'xyz')).toBeNull()
  })
})

describe('buildHunkPatch contra git real', () => {
  it('prepara solo las líneas elegidas', () => {
    writeFileSync(join(dir, 'a.txt'), ORIGINAL.replace('dos\n', 'dos\nnueva-1\nnueva-2\n').replace('tres', 'TRES'))
    const [file] = parseDiff(git('diff', '--', 'a.txt'))
    const hunk = file.hunks[0]
    const keep = new Set([hunk.lines.findIndex((l) => l.text === 'nueva-2')])
    apply(buildHunkPatch(file, hunk, keep, false), '--cached')
    // Las líneas no elegidas de un bloque quedan como contexto antes de las nuevas (igual que `git add -p`)
    expect(git('show', ':a.txt')).toBe(ORIGINAL.replace('tres\n', 'tres\nnueva-2\n'))
    // el archivo de trabajo no se toca
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toContain('nueva-1')
  })

  it('quita del índice solo las líneas elegidas', () => {
    git('add', 'a.txt')
    const [file] = parseDiff(git('diff', '--cached', '--', 'a.txt'))
    const hunk = file.hunks[0]
    const drop = new Set([hunk.lines.findIndex((l) => l.type === '+' && l.text === 'TRES')])
    // también se elige la línea "tres" eliminada para que el cambio vuelva completo
    drop.add(hunk.lines.findIndex((l) => l.type === '-' && l.text === 'tres'))
    apply(buildHunkPatch(file, hunk, drop, true), '--cached', '--reverse')
    expect(git('show', ':a.txt')).toBe(ORIGINAL.replace('tres\n', 'tres\nnueva-1\nnueva-2\n'))
  })

  it('descarta un hunk completo del árbol de trabajo', () => {
    git('reset', '-q')
    const [file] = parseDiff(git('diff', '--', 'a.txt'))
    apply(buildHunkPatch(file, file.hunks[0], null, true), '--reverse')
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe(ORIGINAL)
  })
})

describe('por líneas también en archivos nuevos, borrados y renombrados', () => {
  const read = (file: string): string => readFileSync(join(dir, file), 'utf8')
  const staged = (file: string): string => git('show', `:${file}`)
  const status = (file: string): string => git('status', '--porcelain', '--', file).trimEnd()
  /** Índices de las líneas del primer hunk con ese texto */
  const pick = (hunk: { lines: { text: string }[] }, ...texts: string[]): Set<number> =>
    new Set(hunk.lines.flatMap((l, i) => (texts.includes(l.text) ? [i] : [])))
  const cleanup = (): void => {
    git('reset', '-q', '--hard')
    git('clean', '-fdq')
  }

  it('quita unas líneas de un archivo nuevo preparado: sigue preparado sin ellas', () => {
    writeFileSync(join(dir, 'nuevo.txt'), 'n1\nn2\nn3\n')
    git('add', 'nuevo.txt')
    const [file] = parseDiff(git('diff', '--cached', '--', 'nuevo.txt'))
    expect(file.isNew).toBe(true)
    expect(supportsPartialStaging(file)).toBe(true)
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 'n2'), true), '--cached', '--reverse')
    expect(staged('nuevo.txt')).toBe('n1\nn3\n')
    expect(read('nuevo.txt')).toBe('n1\nn2\nn3\n')
    // Preparado como nuevo y la línea quitada, sin preparar
    expect(status('nuevo.txt')).toBe('AM nuevo.txt')
    cleanup()
  })

  it('quitar todas las líneas de un archivo nuevo lo saca del índice', () => {
    writeFileSync(join(dir, 'nuevo.txt'), 'n1\nn2\n')
    git('add', 'nuevo.txt')
    const [file] = parseDiff(git('diff', '--cached', '--', 'nuevo.txt'))
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 'n1', 'n2'), true), '--cached', '--reverse')
    expect(status('nuevo.txt')).toBe('?? nuevo.txt')
    cleanup()
  })

  it('prepara y descarta unas líneas de un archivo sin seguir', () => {
    writeFileSync(join(dir, 'suelto.txt'), 's1\ns2\ns3\n')
    // Con diferencias, `diff --no-index` sale con código 1
    const noIndex = (() => {
      try {
        return git('diff', '--no-index', '--', '/dev/null', 'suelto.txt')
      } catch (e) {
        return String((e as { stdout: string }).stdout)
      }
    })()
    const [file] = parseDiff(noIndex)
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 's1', 's3'), false), '--cached')
    expect(staged('suelto.txt')).toBe('s1\ns3\n')
    git('rm', '-q', '-f', '--cached', 'suelto.txt')
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 's2'), true), '--reverse')
    expect(read('suelto.txt')).toBe('s1\ns3\n')
    cleanup()
  })

  it('en un borrado preparado, quitar unas líneas las devuelve al índice', () => {
    git('rm', '-q', 'a.txt')
    const [file] = parseDiff(git('diff', '--cached', '--', 'a.txt'))
    expect(file.isDeleted).toBe(true)
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 'uno', 'dos'), true), '--cached', '--reverse')
    expect(staged('a.txt')).toBe('uno\ndos\n')
    expect(existsSync(join(dir, 'a.txt'))).toBe(false)
    cleanup()
  })

  it('en un borrado sin preparar, prepara o descarta unas líneas', () => {
    rmSync(join(dir, 'a.txt'))
    const [file] = parseDiff(git('diff', '--', 'a.txt'))
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 'uno'), false), '--cached')
    expect(staged('a.txt')).toBe(ORIGINAL.replace('uno\n', ''))
    apply(buildHunkPatch(file, file.hunks[0], pick(file.hunks[0], 'diez'), true), '--reverse')
    expect(read('a.txt')).toBe('diez\n')
    cleanup()
  })

  it('en un renombrado, quitar líneas mantiene el renombre preparado', () => {
    git('mv', 'a.txt', 'b.txt')
    writeFileSync(join(dir, 'b.txt'), ORIGINAL.replace('dos', 'DOS').replace('ocho', 'OCHO'))
    git('add', 'b.txt')
    const [file] = parseDiff(git('diff', '--cached', '-M', '--', 'a.txt', 'b.txt'))
    expect(file.isRename).toBe(true)
    const all = file.hunks.flatMap((h, hi) => h.lines.flatMap((l, i) => (l.text === 'OCHO' || l.text === 'ocho' ? [{ hi, i }] : [])))
    apply(buildPatch(file, [{ hunk: all[0].hi, lines: new Set(all.map((x) => x.i)) }], true), '--cached', '--reverse')
    expect(staged('b.txt')).toBe(ORIGINAL.replace('dos', 'DOS'))
    expect(git('ls-files', 'a.txt')).toBe('')
    cleanup()
  })

  it('varios bloques en un solo parche', () => {
    writeFileSync(join(dir, 'a.txt'), ORIGINAL.replace('uno', 'UNO').replace('diez', 'DIEZ'))
    git('add', 'a.txt')
    const [file] = parseDiff(git('diff', '--cached', '-U1', '--', 'a.txt'))
    expect(file.hunks).toHaveLength(2)
    const added = (h: number): Set<number> => new Set(file.hunks[h].lines.flatMap((l, i) => (l.type === '+' ? [i] : [])))
    const removed = (h: number): Set<number> => new Set(file.hunks[h].lines.flatMap((l, i) => (l.type === '-' ? [i] : [])))
    // Del primero se quita solo el borrado de "uno" (queda "uno" y "UNO"); del segundo, el bloque entero
    apply(buildPatch(file, [{ hunk: 1, lines: null }, { hunk: 0, lines: removed(0) }], true), '--cached', '--reverse')
    expect(staged('a.txt')).toBe('uno\nUNO\n' + ORIGINAL.split('\n').slice(1).join('\n'))
    expect(added(0).size).toBe(1)
    expect(buildPatch(file, [{ hunk: 0, lines: new Set() }], true)).toBe('')
    cleanup()
  })

  it('preparar unas líneas no se lleva el cambio de permisos', () => {
    writeFileSync(join(dir, 'a.txt'), ORIGINAL.replace('uno', 'UNO'))
    chmodSync(join(dir, 'a.txt'), 0o755)
    const [file] = parseDiff(git('diff', '--', 'a.txt'))
    apply(buildHunkPatch(file, file.hunks[0], null, false), '--cached')
    expect(git('ls-files', '-s', 'a.txt')).toMatch(/^100644 /)
    expect(staged('a.txt')).toBe(ORIGINAL.replace('uno', 'UNO'))
    expect(statSync(join(dir, 'a.txt')).mode & 0o111).not.toBe(0)
    cleanup()
  })
})

describe('parsers de salida de git', () => {
  it('parseStatus separa preparados, sin preparar, nuevos y conflictos', () => {
    const out = ['M  staged.txt', ' M dirty.txt', 'MM both.txt', '?? nuevo.txt', 'UU choque.txt', 'R  nuevo-nombre.txt', 'viejo-nombre.txt', ''].join('\0')
    const status = parseStatus(out)
    expect(status.staged.map((f) => f.path)).toEqual(['staged.txt', 'both.txt', 'nuevo-nombre.txt'])
    expect(status.staged[2]).toMatchObject({ status: 'R', oldPath: 'viejo-nombre.txt' })
    expect(status.unstaged.map((f) => `${f.status}:${f.path}`)).toEqual(['M:dirty.txt', 'M:both.txt', '?:nuevo.txt'])
    expect(status.conflicted.map((f) => f.path)).toEqual(['choque.txt'])
  })

  it('parseNameStatus entiende renombrados', () => {
    const files = parseNameStatus(['M', 'a.txt', 'R087', 'viejo.txt', 'nuevo.txt', 'D', 'b.txt', ''].join('\0'))
    expect(files).toEqual([
      { status: 'M', path: 'a.txt' },
      { status: 'R', oldPath: 'viejo.txt', path: 'nuevo.txt' },
      { status: 'D', path: 'b.txt' }
    ])
  })
})
