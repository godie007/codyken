import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDiff, readEditable, writeEditable } from '../src/main/git'
import { parseDiff } from '../src/renderer/src/lib/diff'
import { buildHunkPatch } from '../src/renderer/src/lib/patch'

let dir = ''
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const write = (file: string, content: string | Buffer): void => writeFileSync(join(dir, file), content)
const staged = (file: string): string => execFileSync('git', ['show', `:${file}`], { cwd: dir, encoding: 'utf8' })

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'codyken-editar-'))
  execFileSync('git', ['init', '-q', '-b', 'main', dir])
  git('config', 'user.email', 'ana@x.co')
  git('config', 'user.name', 'Ana')
  write('a.txt', 'uno\ndos\ntres\n')
  write('script.sh', '#!/bin/sh\necho hola\n')
  chmodSync(join(dir, 'script.sh'), 0o755)
  write('foto.bin', Buffer.from([0x89, 0x50, 0x00, 0x01]))
  write('latin1.txt', Buffer.from([0x63, 0x61, 0xf1, 0x61, 0x0a]))
  git('add', '-A')
  git('commit', '-q', '-m', 'inicio')
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('editar el archivo de trabajo', () => {
  it('lee el archivo con el índice como comparación y lo guarda', async () => {
    write('a.txt', 'uno\nDOS\ntres\n')
    const file = await readEditable(dir, 'a.txt', 'working')
    expect(file).toMatchObject({ content: 'uno\nDOS\ntres\n', baseline: 'uno\ndos\ntres\n', missing: false })
    const saved = await writeEditable(dir, 'a.txt', 'working', 'uno\nDOS\ntres\ncuatro\n', file.version)
    expect(saved.ok).toBe(true)
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('uno\nDOS\ntres\ncuatro\n')
    // El índice no se toca
    expect(staged('a.txt')).toBe('uno\ndos\ntres\n')
  })

  it('no pisa un archivo que cambió desde que se abrió, salvo que se fuerce', async () => {
    const file = await readEditable(dir, 'a.txt', 'working')
    write('a.txt', 'lo cambió otro programa\n')
    expect(await writeEditable(dir, 'a.txt', 'working', 'mío\n', file.version)).toEqual({ ok: false, changed: true })
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('lo cambió otro programa\n')
    expect((await writeEditable(dir, 'a.txt', 'working', 'mío\n', file.version, true)).ok).toBe(true)
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('mío\n')
  })

  it('conserva los permisos de ejecución al guardar', async () => {
    const file = await readEditable(dir, 'script.sh', 'working')
    await writeEditable(dir, 'script.sh', 'working', '#!/bin/sh\necho adiós\n', file.version)
    expect(statSync(join(dir, 'script.sh')).mode & 0o111).not.toBe(0)
  })

  it('un archivo nuevo sin seguir no tiene comparación', async () => {
    write('nuevo.txt', 'hola\n')
    expect(await readEditable(dir, 'nuevo.txt', 'working')).toMatchObject({ content: 'hola\n', baseline: null })
  })

  it('rechaza binarios, otras codificaciones, rutas fuera del repo, .git y enlaces', async () => {
    await expect(readEditable(dir, 'foto.bin', 'working')).rejects.toThrow('binario')
    await expect(readEditable(dir, 'latin1.txt', 'working')).rejects.toThrow('UTF-8')
    await expect(readEditable(dir, '../fuera.txt', 'working')).rejects.toThrow('fuera del repositorio')
    await expect(readEditable(dir, '.git/config', 'working')).rejects.toThrow('internos de git')
    await expect(writeEditable(dir, '.git/hooks/pre-commit', 'working', 'x', '', true)).rejects.toThrow('internos de git')
    symlinkSync(join(dir, 'a.txt'), join(dir, 'enlace.txt'))
    await expect(readEditable(dir, 'enlace.txt', 'working')).rejects.toThrow('enlace simbólico')
    const outside = mkdtempSync(join(tmpdir(), 'codyken-fuera-'))
    symlinkSync(outside, join(dir, 'carpeta-enlace'))
    await expect(writeEditable(dir, 'carpeta-enlace/x.txt', 'working', 'x', '', true)).rejects.toThrow('fuera del repositorio')
    rmSync(outside, { recursive: true, force: true })
    rmSync(join(dir, 'enlace.txt'))
    rmSync(join(dir, 'carpeta-enlace'))
  })
})

describe('editar el archivo con la versión de un commit', () => {
  it('propone el contenido del commit y al guardar queda como cambio sin preparar', async () => {
    git('checkout', '--', 'a.txt')
    const first = git('rev-list', '--max-parents=0', 'HEAD')
    write('a.txt', 'uno\ndos\ntres\nnuevo\n')
    git('commit', '-q', '-m', 'otra versión', 'a.txt')
    const file = await readEditable(dir, 'a.txt', 'working', undefined, first)
    expect(file).toMatchObject({ content: 'uno\ndos\ntres\nnuevo\n', proposed: 'uno\ndos\ntres\n' })
    await writeEditable(dir, 'a.txt', 'working', file.proposed!, file.version)
    expect(git('status', '--porcelain', 'a.txt')).toBe('M a.txt')
    expect(git('diff', '--cached', '--name-only')).toBe('')
    git('reset', '-q', '--hard', 'HEAD~1')
  })

  it('avisa si el archivo no existía en ese commit y rechaza revisiones raras', async () => {
    const first = git('rev-list', '--max-parents=0', 'HEAD')
    write('solo-ahora.txt', 'x\n')
    await expect(readEditable(dir, 'solo-ahora.txt', 'working', undefined, first)).rejects.toThrow('no existe en')
    await expect(readEditable(dir, 'a.txt', 'working', undefined, '--output=/tmp/x')).rejects.toThrow('no válido')
    rmSync(join(dir, 'solo-ahora.txt'))
  })
})

describe('editar la versión preparada', () => {
  it('lee el índice con HEAD como comparación y guarda sin tocar el archivo de trabajo', async () => {
    git('checkout', '--', 'a.txt')
    write('a.txt', 'uno\ndos\ntres\ncuatro\n')
    const file = await readEditable(dir, 'a.txt', 'index')
    expect(file).toMatchObject({ content: 'uno\ndos\ntres\n', baseline: 'uno\ndos\ntres\n', missing: false })
    const saved = await writeEditable(dir, 'a.txt', 'index', 'uno\ndos (versión para el commit)\ntres\n', file.version)
    expect(saved.ok).toBe(true)
    expect(staged('a.txt')).toBe('uno\ndos (versión para el commit)\ntres\n')
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('uno\ndos\ntres\ncuatro\n')
    expect(git('diff', '--cached', '--name-only')).toBe('a.txt')
  })

  it('no pisa la versión preparada si cambió entretanto', async () => {
    const file = await readEditable(dir, 'a.txt', 'index')
    git('add', 'a.txt')
    expect(await writeEditable(dir, 'a.txt', 'index', 'otra\n', file.version)).toEqual({ ok: false, changed: true })
    git('reset', '-q')
  })

  it('propone el índice con las líneas elegidas sin cambiar el índice real', async () => {
    git('checkout', '--', 'a.txt')
    write('a.txt', 'cero\nuno\ndos\ntres\ncuatro\n')
    const diff = parseDiff(await getDiff(dir, { kind: 'unstaged', path: 'a.txt', status: 'M' }, false))[0]
    const hunk = diff.hunks[0]
    const firstAdded = hunk.lines.findIndex((l) => l.type === '+')
    const patch = buildHunkPatch(diff, hunk, new Set([firstAdded]), false)
    const before = git('ls-files', '-s', 'a.txt')
    const file = await readEditable(dir, 'a.txt', 'index', patch)
    expect(file.proposed).toBe('cero\nuno\ndos\ntres\n')
    expect(file.content).toBe('uno\ndos\ntres\n')
    expect(git('ls-files', '-s', 'a.txt')).toBe(before)
    // Se ajusta la línea antes de prepararla
    await writeEditable(dir, 'a.txt', 'index', 'CERO\nuno\ndos\ntres\n', file.version)
    expect(staged('a.txt')).toBe('CERO\nuno\ndos\ntres\n')
    git('reset', '-q')
  })

  it('también sirve con las líneas de un archivo sin seguir, y lo prepara con su modo', async () => {
    mkdirSync(join(dir, 'bin'))
    write('bin/run', 'línea 1\nlínea 2\n')
    chmodSync(join(dir, 'bin/run'), 0o755)
    const diff = parseDiff(await getDiff(dir, { kind: 'unstaged', path: 'bin/run', status: '?' }, false))[0]
    const patch = buildHunkPatch(diff, diff.hunks[0], new Set([0]), false)
    const file = await readEditable(dir, 'bin/run', 'index', patch)
    expect(file).toMatchObject({ content: '', missing: true, baseline: null, version: '' })
    expect(file.proposed).toBe('línea 1\n')
    await writeEditable(dir, 'bin/run', 'index', file.proposed!, file.version)
    expect(git('ls-files', '-s', 'bin/run')).toMatch(/^100755 /)
    expect(staged('bin/run')).toBe('línea 1\n')
    git('reset', '-q')
  })

  it('rechaza archivos en conflicto', async () => {
    git('checkout', '-q', '-b', 'otra')
    write('a.txt', 'en otra\n')
    git('commit', '-q', '-am', 'otra')
    git('checkout', '-q', 'main')
    write('a.txt', 'en main\n')
    git('commit', '-q', '-am', 'main')
    expect(() => execFileSync('git', ['merge', 'otra'], { cwd: dir, stdio: 'ignore' })).toThrow()
    await expect(readEditable(dir, 'a.txt', 'index')).rejects.toThrow('en conflicto')
    await expect(writeEditable(dir, 'a.txt', 'working', 'x', '', true)).rejects.toThrow('en conflicto')
    git('merge', '--abort')
  })
})
