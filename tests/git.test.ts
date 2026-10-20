import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getBlame, getFileHistory, getLog, getRemotes, stashLabel } from '../src/main/git'

let dir = ''
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
const commit = (file: string, content: string, message: string, author = 'Ana <ana@x.co>'): void => {
  writeFileSync(join(dir, file), content)
  git('add', '-A')
  git('commit', '-q', '-m', message, `--author=${author}`)
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'codyken-git-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'ana@x.co')
  git('config', 'user.name', 'Ana')
  commit('a.txt', 'uno\n', 'inicio')
  git('checkout', '-q', '-b', 'feature')
  commit('b.txt', 'b\n', 'en feature', 'Luis <luis@x.co>')
  git('checkout', '-q', 'main')
  commit('a.txt', 'uno\ndos\n', 'segunda línea')
  git('mv', 'a.txt', 'renombrado.txt')
  git('commit', '-q', '-m', 'renombra')
  git('remote', 'add', 'origin', 'git@github.com:codla/demo.git')
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('getLog con filtro de ramas', () => {
  it('sin filtro muestra todas las ramas', async () => {
    const subjects = (await getLog(dir, 50)).map((c) => c.subject)
    expect(subjects).toContain('en feature')
    expect(subjects).toHaveLength(4)
  })

  it('ocultar una rama quita sus commits exclusivos', async () => {
    const subjects = (await getLog(dir, 50, { hidden: ['refs/heads/feature'], solo: [] })).map((c) => c.subject)
    expect(subjects).not.toContain('en feature')
  })

  it('modo "solo" muestra la rama elegida y HEAD', async () => {
    const subjects = (await getLog(dir, 50, { hidden: [], solo: ['refs/heads/feature'] })).map((c) => c.subject)
    expect(subjects).toContain('en feature')
    expect(subjects).toContain('renombra')
  })

  it('rechaza referencias raras', async () => {
    await expect(getLog(dir, 5, { hidden: ['--output=/tmp/x'], solo: [] })).rejects.toThrow('no válida')
  })
})

describe('historial, blame y remotos', () => {
  it('sigue el archivo a través de un renombre', async () => {
    const history = await getFileHistory(dir, 'renombrado.txt', 20)
    expect(history.map((h) => h.subject)).toEqual(['renombra', 'segunda línea', 'inicio'])
    expect(history[0]).toMatchObject({ path: 'renombrado.txt', oldPath: 'a.txt', status: 'R' })
    expect(history[2].path).toBe('a.txt')
  })

  it('blame atribuye cada línea a su commit', async () => {
    const lines = await getBlame(dir, 'renombrado.txt', null)
    expect(lines.map((l) => [l.line, l.text, l.summary])).toEqual([
      [1, 'uno', 'inicio'],
      [2, 'dos', 'segunda línea']
    ])
    expect(lines[0].author).toBe('Ana')
  })

  it('extrae el servidor del remoto', async () => {
    expect(await getRemotes(dir)).toEqual([{ name: 'origin', url: 'git@github.com:codla/demo.git', host: 'github.com' }])
  })
})

describe('stashLabel', () => {
  it('quita el hash de los stashes automáticos y el prefijo de los con nombre', () => {
    expect(stashLabel('WIP on dev: 046e6c54 feat(pdf): membrete')).toBe('WIP en dev: feat(pdf): membrete')
    expect(stashLabel('On dev: antes de publicar')).toBe('antes de publicar')
  })
})
