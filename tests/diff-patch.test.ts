import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseNameStatus, parseStatus } from '../src/main/git'
import { intraline, parseDiff, toSplitRows } from '../src/renderer/src/lib/diff'
import { buildHunkPatch, supportsPartialStaging } from '../src/renderer/src/lib/patch'

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
