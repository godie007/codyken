import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addWorktree,
  buildRebaseTodo,
  compareRefs,
  getConflictVersions,
  getRebaseCommits,
  getWorktrees,
  interactiveRebase,
  parseLfsAttributes,
  parseLfsFiles,
  parseLfsTrack,
  parseWorktrees,
  removeWorktree,
  saveConflictResolution
} from '../src/main/git'
import { parseGithubPrs, parseGitlabMrs, parseRemoteUrl, providerOf } from '../src/main/integrations'

let dir = ''
let root = ''
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const commit = (file: string, content: string, message: string): string => {
  writeFileSync(join(dir, file), content)
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}
const subjects = (range = 'HEAD'): string[] => git('log', '--format=%s', range).split('\n')

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'codyken-feat-'))
  dir = join(root, 'repo')
  execFileSync('git', ['init', '-q', '-b', 'main', dir])
  git('config', 'user.email', 'ana@x.co')
  git('config', 'user.name', 'Ana')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('rebase interactivo', () => {
  it('reordena, reescribe, combina y descarta commits', async () => {
    const base = commit('a.txt', 'a\n', 'base')
    const uno = commit('b.txt', 'b\n', 'uno')
    const dos = commit('c.txt', 'c\n', 'dos')
    const tres = commit('d.txt', 'd\n', 'tres')
    const cuatro = commit('e.txt', 'e\n', 'cuatro')
    const commits = await getRebaseCommits(dir, uno)
    expect(commits.map((c) => c.subject)).toEqual(['uno', 'dos', 'tres', 'cuatro'])
    await interactiveRebase(dir, uno, [
      { hash: dos, action: 'reword', message: 'dos reescrito\n\ncon cuerpo' },
      { hash: uno, action: 'pick' },
      { hash: tres, action: 'fixup' },
      { hash: cuatro, action: 'drop' }
    ])
    expect(subjects()).toEqual(['uno', 'dos reescrito', 'base'])
    expect(git('log', '-1', '--format=%B', 'HEAD~1')).toBe('dos reescrito\n\ncon cuerpo')
    expect(git('ls-files').split('\n')).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt'])
    expect(git('rev-parse', 'HEAD~2')).toBe(base)
  })

  it('squash junta los mensajes sin comentarios', async () => {
    const a = commit('f.txt', 'f\n', 'parte A')
    const b = commit('g.txt', 'g\n', 'parte B')
    await interactiveRebase(dir, a, [
      { hash: a, action: 'pick' },
      { hash: b, action: 'squash' }
    ])
    const message = git('log', '-1', '--format=%B')
    expect(message).toContain('parte A')
    expect(message).toContain('parte B')
    expect(message).not.toContain('#')
    expect(subjects()[1]).toBe('uno')
  })

  it('valida la lista antes de tocar el repo', () => {
    const commits = [{ hash: 'a'.repeat(40) }, { hash: 'b'.repeat(40) }]
    const file = (i: number): string => `/tmp/m${i}`
    expect(() => buildRebaseTodo([{ hash: 'a'.repeat(40), action: 'pick' }], commits, file)).toThrow('Faltan')
    expect(() => buildRebaseTodo([{ hash: 'a'.repeat(40), action: 'squash' }, { hash: 'b'.repeat(40), action: 'pick' }], commits, file)).toThrow('primer commit')
    expect(() => buildRebaseTodo([{ hash: 'c'.repeat(40), action: 'pick' }, { hash: 'b'.repeat(40), action: 'pick' }], commits, file)).toThrow('no coincide')
    expect(buildRebaseTodo([{ hash: 'b'.repeat(40), action: 'reword', message: 'x' }, { hash: 'a'.repeat(40), action: 'squash' }], commits, file)).toBe(
      `pick ${'b'.repeat(40)}\nexec git commit --amend --allow-empty --no-verify --cleanup=strip -F '/tmp/m0'\nsquash ${'a'.repeat(40)}\n`
    )
  })

  it('rechaza commits que no están en la rama actual', async () => {
    git('checkout', '-q', '-b', 'otra')
    const ajeno = commit('z.txt', 'z\n', 'ajeno')
    git('checkout', '-q', 'main')
    await expect(getRebaseCommits(dir, ajeno)).rejects.toThrow('no está en la historia')
  })
})

describe('comparar', () => {
  it('cuenta los commits de cada lado y lista los archivos distintos', async () => {
    const result = await compareRefs(dir, 'main', 'otra')
    expect(result.aheadCount).toBe(1)
    expect(result.behindCount).toBe(0)
    expect(result.ahead.map((c) => c.subject)).toEqual(['ajeno'])
    expect(result.files).toEqual([{ path: 'z.txt', status: 'A' }])
    expect(result.mergeBase).toBe(git('rev-parse', 'main'))
  })
})

describe('conflictos', () => {
  it('lee las tres versiones y guarda la resolución preparada', async () => {
    git('checkout', '-q', '-b', 'lado')
    commit('a.txt', 'a del lado\n', 'lado')
    git('checkout', '-q', 'main')
    commit('a.txt', 'a de main\n', 'main cambia a')
    try {
      git('merge', 'lado')
    } catch {
      // conflicto esperado
    }
    const versions = await getConflictVersions(dir, 'a.txt')
    expect(versions.base).toBe('a\n')
    expect(versions.ours).toBe('a de main\n')
    expect(versions.theirs).toBe('a del lado\n')
    expect(versions.working).toContain('<<<<<<<')
    await saveConflictResolution(dir, 'a.txt', 'a combinada\n')
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('a combinada\n')
    expect(git('diff', '--name-only', '--diff-filter=U')).toBe('')
    git('commit', '-q', '--no-edit')
    await expect(saveConflictResolution(dir, '../fuera.txt', 'x')).rejects.toThrow('fuera')
  })
})

describe('worktrees', () => {
  it('crea, lista y elimina un worktree con rama nueva', async () => {
    const path = join(root, 'repo-tarea')
    const created = await addWorktree(dir, path, 'tarea', true)
    expect(created.endsWith('repo-tarea')).toBe(true)
    const list = await getWorktrees(dir)
    expect(list.map((w) => [w.branch, w.isMain])).toEqual([['main', true], ['tarea', false]])
    await expect(removeWorktree(dir, list[0].path, false)).rejects.toThrow('principal')
    await removeWorktree(dir, list[1].path, false)
    expect(await getWorktrees(dir)).toHaveLength(1)
  })

  it('entiende la salida porcelain', () => {
    const out = 'worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r2\nHEAD def\ndetached\nlocked motivo\n\nworktree /r3\nHEAD 123\nbranch refs/heads/x\nprunable gitdir file points to non-existent location\n'
    expect(parseWorktrees(out).map((w) => [w.path, w.branch, w.detached, w.locked, w.prunable, w.isMain])).toEqual([
      ['/r', 'main', false, false, false, true],
      ['/r2', null, true, true, false, false],
      ['/r3', 'x', false, false, true, false]
    ])
  })
})

describe('LFS y pull requests', () => {
  it('lee los patrones y archivos de git lfs', () => {
    expect(parseLfsTrack('Listing tracked patterns\n    *.psd (.gitattributes)\n    assets/** (assets/.gitattributes)\nListing excluded patterns\n')).toEqual([
      { pattern: '*.psd', source: '.gitattributes' },
      { pattern: 'assets/**', source: 'assets/.gitattributes' }
    ])
    expect(parseLfsFiles(`${'a'.repeat(64)} * diseño/logo grande.psd\n${'b'.repeat(64)} - video.mp4\n`)).toEqual([
      { oid: 'a'.repeat(64), downloaded: true, path: 'diseño/logo grande.psd' },
      { oid: 'b'.repeat(64), downloaded: false, path: 'video.mp4' }
    ])
  })

  it('sin git-lfs detecta los patrones en .gitattributes', () => {
    expect(parseLfsAttributes('# binarios\n*.psd filter=lfs diff=lfs merge=lfs -text\n*.txt text\nvideos/** filter=lfs -text\n')).toEqual([
      { pattern: '*.psd', source: '.gitattributes' },
      { pattern: 'videos/**', source: '.gitattributes' }
    ])
  })

  it('reconoce el servidor y la ruta del remoto', () => {
    expect(parseRemoteUrl('git@github.com:godie007/codyken.git')).toEqual({ host: 'github.com', path: 'godie007/codyken' })
    expect(parseRemoteUrl('https://gitlab.com/grupo/sub/proyecto.git')).toEqual({ host: 'gitlab.com', path: 'grupo/sub/proyecto' })
    expect(parseRemoteUrl('ssh://git@gitlab.empresa.co:2222/equipo/api.git')).toEqual({ host: 'gitlab.empresa.co', path: 'equipo/api' })
    expect(parseRemoteUrl('git@alias-trabajo:org/repo.git')).toEqual({ host: 'alias-trabajo', path: 'org/repo' })
    expect(parseRemoteUrl('/srv/git/local.git')).toBeNull()
    expect([providerOf('github.com'), providerOf('gitlab.empresa.co'), providerOf('bitbucket.org')]).toEqual(['github', 'gitlab', null])
  })

  it('convierte la respuesta de gh y glab', () => {
    expect(parseGithubPrs('[{"number":7,"title":"Login","author":{"login":"ana"},"headRefName":"feature/login","baseRefName":"main","url":"https://github.com/o/r/pull/7","isDraft":true,"updatedAt":"2026-10-20T10:00:00Z"}]')).toEqual([
      { number: 7, title: 'Login', author: 'ana', head: 'feature/login', base: 'main', url: 'https://github.com/o/r/pull/7', draft: true, updatedAt: Date.parse('2026-10-20T10:00:00Z') }
    ])
    expect(parseGitlabMrs('[{"iid":3,"title":"Pagos","author":{"username":"luis"},"source_branch":"feature/pagos","target_branch":"main","web_url":"https://gitlab.com/g/p/-/merge_requests/3","draft":false,"updated_at":"2026-10-19T08:00:00Z"}]')[0]).toMatchObject({ number: 3, head: 'feature/pagos', author: 'luis' })
  })
})
