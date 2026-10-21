import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path'
import type {
  CheckoutTarget,
  BlameLine,
  Commit,
  CommitDetail,
  Comparison,
  ConflictVersions,
  DiffSource,
  FileChange,
  FileHistoryEntry,
  FetchResult,
  FileStatus,
  GraphFilter,
  LfsInfo,
  PullMode,
  RebaseCommit,
  RebaseMode,
  RebaseStep,
  Ref,
  Remote,
  RepoOperation,
  RepoState,
  ResetMode,
  StashEntry,
  WorkingStatus,
  Worktree
} from '../shared/types'

export class GitError extends Error {}

function buildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  // Las apps abiertas desde Finder heredan un PATH mínimo
  const parts = (env.PATH ?? '').split(':').filter(Boolean)
  for (const extra of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']) {
    if (!parts.includes(extra)) parts.push(extra)
  }
  env.PATH = parts.join(':')
  // Sin terminal no hay a quién pedirle credenciales: mejor fallar que quedar colgado
  env.GIT_TERMINAL_PROMPT = '0'
  env.GIT_OPTIONAL_LOCKS = '0'
  env.GIT_EDITOR = 'true'
  env.GIT_MERGE_AUTOEDIT = 'no'
  if (!env.GIT_SSH_COMMAND && !env.GIT_SSH) env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes'
  return env
}

export const ENV = buildEnv()
const FS = '\x1f'
const RS = '\x1e'

interface RunOptions {
  input?: string
  okCodes?: number[]
  /** Variables extra para esta llamada */
  env?: NodeJS.ProcessEnv
}

export function git(cwd: string, args: string[], options: RunOptions = {}): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args], { cwd, env: options.env ? { ...ENV, ...options.env } : ENV })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(new GitError(error.code === 'ENOENT' ? 'No se encontró git. Instala las herramientas de línea de comandos de Xcode.' : error.message))
    })
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8')
      if ((options.okCodes ?? [0]).includes(code ?? -1)) {
        resolvePromise(stdout)
        return
      }
      const stderr = Buffer.concat(err).toString('utf8').trim()
      reject(new GitError(stderr || stdout.trim() || `git ${args[0]} terminó con código ${code}`))
    })
    child.stdin.on('error', () => {})
    child.stdin.end(options.input ?? '')
  })
}

function assertArg(value: string, what: string): string {
  if (!value || value.startsWith('-') || value.includes('\0')) throw new GitError(`${what} no válido: ${value}`)
  return value
}

async function assertBranchName(repo: string, name: string): Promise<string> {
  assertArg(name, 'Nombre de rama')
  try {
    await git(repo, ['check-ref-format', '--branch', name])
  } catch {
    throw new GitError(`"${name}" no es un nombre de rama válido`)
  }
  return name
}

async function hasHead(repo: string): Promise<boolean> {
  const out = await git(repo, ['rev-parse', '--verify', '-q', 'HEAD'], { okCodes: [0, 1] })
  return out.trim().length > 0
}

async function currentBranch(repo: string): Promise<string | null> {
  const out = await git(repo, ['symbolic-ref', '--short', '-q', 'HEAD'], { okCodes: [0, 1] })
  return out.trim() || null
}

// ── Repositorios ────────────────────────────────────────────────────────────

export async function resolveRepo(path: string): Promise<string> {
  if (!isAbsolute(path) || !existsSync(path)) throw new GitError(`La carpeta no existe: ${path}`)
  try {
    return (await git(path, ['rev-parse', '--show-toplevel'])).trim()
  } catch {
    throw new GitError(`No es un repositorio Git: ${path}`)
  }
}

export async function initRepo(path: string): Promise<string> {
  await git(path, ['init'])
  return resolveRepo(path)
}

export async function cloneRepo(url: string, parentDir: string): Promise<string> {
  assertArg(url.trim(), 'URL')
  const name = basename(url.trim().replace(/[\\/]+$/, '')).replace(/\.git$/, '') || 'repositorio'
  const dest = join(parentDir, name)
  if (existsSync(dest)) throw new GitError(`Ya existe la carpeta ${dest}`)
  await git(parentDir, ['clone', '--', url.trim(), dest])
  return resolveRepo(dest)
}

// ── Lectura ─────────────────────────────────────────────────────────────────

const LOG_FORMAT = '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1e'

function parseCommitFields(fields: string[]): Commit {
  const [hash, parents, author, email, date, subject] = fields
  return { hash, parents: parents ? parents.split(' ') : [], author, email, date: Number(date) * 1000, subject: subject ?? '' }
}

function safeRef(ref: string): string {
  if (!/^refs\/(heads|remotes|tags)\//.test(ref) || ref.includes('\0') || ref.includes('..')) throw new GitError(`Referencia no válida: ${ref}`)
  return ref
}

export async function getLog(repo: string, limit: number, filter: GraphFilter = { hidden: [], solo: [] }): Promise<Commit[]> {
  // HEAD siempre se dibuja, aunque su rama esté oculta, para no perder el punto de trabajo
  const revs = filter.solo.length
    ? [...filter.solo.map(safeRef), 'HEAD']
    : [...filter.hidden.map((ref) => `--exclude=${safeRef(ref)}`), '--exclude=refs/stash', '--all']
  let out: string
  try {
    // Orden cronológico (respetando padres): los merges quedan junto a lo que integran y los carriles son cortos
    out = await git(repo, ['log', '--date-order', '-n', String(limit), LOG_FORMAT, ...revs, '--'])
  } catch (error) {
    if (!(await hasHead(repo))) return []
    throw error
  }
  return parseLog(out)
}

function parseLog(out: string): Commit[] {
  const commits: Commit[] = []
  for (const record of out.split(RS)) {
    const line = record.replace(/^\n/, '')
    if (line) commits.push(parseCommitFields(line.split(FS)))
  }
  return commits
}

export function remoteHost(url: string): string {
  return url.startsWith('/') || url.startsWith('.') ? 'local' : /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(url)?.[1] ?? ''
}

export async function getRemotes(repo: string): Promise<Remote[]> {
  const out = await git(repo, ['remote', '-v'])
  const remotes = new Map<string, Remote>()
  for (const line of out.split('\n')) {
    const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line)
    if (!match) continue
    const [, name, url] = match
    remotes.set(name, { name, url, host: remoteHost(url) })
  }
  return [...remotes.values()]
}

export async function getFileHistory(repo: string, path: string, limit: number): Promise<FileHistoryEntry[]> {
  const out = await git(repo, ['log', '--follow', '-M', '-n', String(limit), '--name-status', '--format=%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s', '--', path])
  const entries: FileHistoryEntry[] = []
  for (const record of out.split(RS)) {
    if (!record.trim()) continue
    const [header, ...rest] = record.split('\n')
    const commit = parseCommitFields(header.split(FS))
    const change = rest.find((l) => l.trim())?.split('\t') ?? []
    const code = change[0] ?? 'M'
    const filePath = change.length >= 3 ? change[2] : change[1] ?? path
    entries.push({ ...commit, path: filePath, oldPath: change.length >= 3 ? change[1] : undefined, status: toStatus(code[0]) })
  }
  return entries
}

export async function getBlame(repo: string, path: string, rev: string | null): Promise<BlameLine[]> {
  const out = await git(repo, ['blame', '--porcelain', ...(rev ? [assertArg(rev, 'Commit')] : []), '--', path])
  const info = new Map<string, { author: string; email: string; date: number; summary: string }>()
  const lines: BlameLine[] = []
  let current: { hash: string; line: number } | null = null
  let pending: { author?: string; email?: string; date?: number; summary?: string } = {}
  for (const row of out.split('\n')) {
    if (row.startsWith('\t')) {
      if (!current) continue
      if (!info.has(current.hash)) info.set(current.hash, { author: pending.author ?? '', email: pending.email ?? '', date: pending.date ?? 0, summary: pending.summary ?? '' })
      const meta = info.get(current.hash)!
      lines.push({ hash: current.hash, line: current.line, text: row.slice(1), ...meta })
      current = null
      pending = {}
      continue
    }
    const header = /^([0-9a-f]{40}) \d+ (\d+)/.exec(row)
    if (header) {
      current = { hash: header[1], line: Number(header[2]) }
      continue
    }
    if (row.startsWith('author ')) pending.author = row.slice(7)
    else if (row.startsWith('author-mail ')) pending.email = row.slice(12).replace(/[<>]/g, '')
    else if (row.startsWith('author-time ')) pending.date = Number(row.slice(12)) * 1000
    else if (row.startsWith('summary ')) pending.summary = row.slice(8)
  }
  return lines
}

export async function getRefs(repo: string): Promise<Ref[]> {
  const out = await git(repo, [
    'for-each-ref',
    '--format=%(refname)%1f%(objectname)%1f%(*objectname)%1f%(upstream:short)%1f%(upstream:track,nobracket)%1f%(HEAD)%1f%(symref)',
    'refs/heads', 'refs/remotes', 'refs/tags'
  ])
  const refs: Ref[] = []
  for (const line of out.split('\n')) {
    if (!line) continue
    const [fullName, objectName, peeled, upstream, track, head, symref] = line.split(FS)
    if (symref) continue
    const hash = peeled || objectName
    if (fullName.startsWith('refs/heads/')) {
      const ahead = /ahead (\d+)/.exec(track)
      const behind = /behind (\d+)/.exec(track)
      refs.push({
        type: 'local',
        name: fullName.slice('refs/heads/'.length),
        fullName,
        hash,
        upstream: upstream || undefined,
        ahead: ahead ? Number(ahead[1]) : 0,
        behind: behind ? Number(behind[1]) : 0,
        gone: track === 'gone',
        isHead: head === '*'
      })
    } else if (fullName.startsWith('refs/remotes/')) {
      const name = fullName.slice('refs/remotes/'.length)
      refs.push({ type: 'remote', name, fullName, hash, remote: name.split('/')[0] })
    } else {
      refs.push({ type: 'tag', name: fullName.slice('refs/tags/'.length), fullName, hash })
    }
  }
  return refs
}

export async function getRepoState(repo: string): Promise<RepoState> {
  const [gitDirOut, headOut, branch] = await Promise.all([
    git(repo, ['rev-parse', '--absolute-git-dir']),
    git(repo, ['rev-parse', '--verify', '-q', 'HEAD'], { okCodes: [0, 1] }),
    currentBranch(repo)
  ])
  const gitDir = gitDirOut.trim()
  let operation: RepoOperation | null = null
  if (existsSync(join(gitDir, 'rebase-merge')) || existsSync(join(gitDir, 'rebase-apply'))) operation = 'rebase'
  else if (existsSync(join(gitDir, 'MERGE_HEAD'))) operation = 'merge'
  else if (existsSync(join(gitDir, 'CHERRY_PICK_HEAD'))) operation = 'cherry-pick'
  else if (existsSync(join(gitDir, 'REVERT_HEAD'))) operation = 'revert'
  const head = headOut.trim() || null
  return { root: repo, head, branch, detached: !branch && !!head, operation }
}

export async function getGitDir(repo: string): Promise<string> {
  return (await git(repo, ['rev-parse', '--absolute-git-dir'])).trim()
}

const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

export function parseStatus(out: string): WorkingStatus {
  const status: WorkingStatus = { staged: [], unstaged: [], conflicted: [] }
  const parts = out.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const x = entry[0]
    const y = entry[1]
    const path = entry.slice(3)
    let oldPath: string | undefined
    if (x === 'R' || x === 'C') oldPath = parts[++i]
    if (CONFLICT_CODES.has(x + y)) {
      status.conflicted.push({ path, status: 'U' })
      continue
    }
    if (x === '?' && y === '?') {
      status.unstaged.push({ path, status: '?' })
      continue
    }
    if (x !== ' ' && x !== '!') status.staged.push({ path, oldPath, status: toStatus(x) })
    if (y !== ' ' && y !== '!') status.unstaged.push({ path, status: toStatus(y) })
  }
  return status
}

function toStatus(code: string): FileStatus {
  if (code === 'A' || code === 'D' || code === 'R' || code === 'C') return code
  return 'M'
}

export async function getStatus(repo: string): Promise<WorkingStatus> {
  return parseStatus(await git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']))
}

/** "WIP on dev: 046e6c5 asunto" → "WIP en dev: asunto"; "On dev: mensaje" → "mensaje" */
export function stashLabel(raw: string): string {
  const wip = /^WIP on ([^:]+): [0-9a-f]{7,} (.*)$/.exec(raw)
  if (wip) return `WIP en ${wip[1]}: ${wip[2]}`
  return raw.replace(/^On [^:]+: /, '')
}

export async function getStashes(repo: string): Promise<StashEntry[]> {
  const out = await git(repo, ['stash', 'list', '--format=%gd%x1f%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%gs'])
  return out.split('\n').filter(Boolean).map((line) => {
    const [ref, hash, parents, author, email, date, message] = line.split(FS)
    const index = Number(/\{(\d+)\}/.exec(ref)?.[1] ?? 0)
    return { index, hash, base: parents.split(' ')[0], author, email, date: Number(date) * 1000, message: stashLabel(message) }
  })
}

export async function getSubmodules(repo: string): Promise<string[]> {
  if (!existsSync(join(repo, '.gitmodules'))) return []
  const out = await git(repo, ['config', '-f', '.gitmodules', '--get-regexp', 'path'], { okCodes: [0, 1] })
  return out.split('\n').filter(Boolean).map((line) => line.slice(line.indexOf(' ') + 1))
}

export function parseNameStatus(out: string): FileChange[] {
  const tokens = out.split('\0')
  const files: FileChange[] = []
  let i = 0
  while (i < tokens.length) {
    const code = tokens[i]
    if (!code) {
      i++
      continue
    }
    if (code[0] === 'R' || code[0] === 'C') {
      files.push({ status: code[0] as FileStatus, oldPath: tokens[i + 1], path: tokens[i + 2] })
      i += 3
    } else {
      files.push({ status: toStatus(code[0]), path: tokens[i + 1] })
      i += 2
    }
  }
  return files
}

export async function getCommitDetail(repo: string, hash: string): Promise<CommitDetail> {
  assertArg(hash, 'Commit')
  const out = await git(repo, ['show', '-s', '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%B', hash])
  const [full, parents, author, email, date, committer, committerEmail, committerDate, ...message] = out.split(FS)
  const parentList = parents ? parents.split(' ') : []
  const filesOut = parentList.length
    ? await git(repo, ['diff', '--name-status', '-z', '-M', parentList[0], full])
    : await git(repo, ['diff-tree', '--root', '--no-commit-id', '-r', '--name-status', '-z', '-M', full])
  const files = parseNameStatus(filesOut)
  // Un stash con archivos nuevos (-u) los guarda en un tercer padre sin historia propia
  if (parentList.length === 3) {
    const third = await git(repo, ['rev-list', '--parents', '-n', '1', parentList[2]])
    if (third.trim().split(' ').length === 1) {
      const untracked = parseNameStatus(await git(repo, ['diff-tree', '--root', '--no-commit-id', '-r', '--name-status', '-z', parentList[2]]))
      for (const f of untracked) files.push({ ...f, status: '?', commit: parentList[2] })
    }
  }
  return {
    hash: full,
    parents: parentList,
    author,
    email,
    date: Number(date) * 1000,
    committer,
    committerEmail,
    committerDate: Number(committerDate) * 1000,
    message: message.join(FS).trimEnd(),
    files
  }
}

const MAX_DIFF_BYTES = 8 * 1024 * 1024

export async function getDiff(repo: string, source: DiffSource, full: boolean): Promise<string> {
  const context = full ? '-U1000000' : '-U3'
  let out: string
  switch (source.kind) {
    case 'unstaged':
      out = source.status === '?'
        ? await git(repo, ['diff', '--no-index', context, '--', '/dev/null', source.path], { okCodes: [0, 1] })
        : await git(repo, ['diff', context, '--', source.path])
      break
    case 'staged':
      out = await git(repo, ['diff', '--cached', '-M', context, '--', ...(source.oldPath ? [source.oldPath] : []), source.path])
      break
    case 'commit':
      out = source.parent
        ? await git(repo, ['diff', '-M', context, assertArg(source.parent, 'Commit'), assertArg(source.hash, 'Commit'), '--', ...(source.oldPath ? [source.oldPath] : []), source.path])
        : await git(repo, ['show', '--format=', context, assertArg(source.hash, 'Commit'), '--', source.path])
      break
    case 'conflict':
      out = await readWorkingFile(repo, source.path)
      break
  }
  if (out.length > MAX_DIFF_BYTES) throw new GitError('El diff es demasiado grande para mostrarlo.')
  return out
}

export async function readWorkingFile(repo: string, path: string): Promise<string> {
  const target = resolve(repo, path)
  const rel = relative(repo, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new GitError('Ruta fuera del repositorio')
  const info = await stat(target)
  if (info.size > MAX_DIFF_BYTES) throw new GitError('El archivo es demasiado grande para mostrarlo.')
  return readFile(target, 'utf8')
}

export async function getLastCommitMessage(repo: string): Promise<string> {
  if (!(await hasHead(repo))) return ''
  return (await git(repo, ['log', '-1', '--format=%B'])).trimEnd()
}

// ── Comparar ────────────────────────────────────────────────────────────────

const COMPARE_LIMIT = 200

export async function compareRefs(repo: string, base: string, target: string): Promise<Comparison> {
  const [b, t] = (await git(repo, ['rev-parse', `${assertArg(base, 'Referencia')}^{commit}`, `${assertArg(target, 'Referencia')}^{commit}`])).trim().split('\n')
  const [counts, files, ahead, behind, mergeBase] = await Promise.all([
    git(repo, ['rev-list', '--left-right', '--count', `${b}...${t}`]),
    git(repo, ['diff', '--name-status', '-z', '-M', b, t]),
    git(repo, ['log', '-n', String(COMPARE_LIMIT), LOG_FORMAT, `${b}..${t}`, '--']),
    git(repo, ['log', '-n', String(COMPARE_LIMIT), LOG_FORMAT, `${t}..${b}`, '--']),
    git(repo, ['merge-base', b, t], { okCodes: [0, 1] })
  ])
  const [behindCount, aheadCount] = counts.trim().split(/\s+/).map(Number)
  return {
    base: b,
    target: t,
    mergeBase: mergeBase.trim() || null,
    files: parseNameStatus(files),
    ahead: parseLog(ahead),
    behind: parseLog(behind),
    aheadCount,
    behindCount
  }
}

// ── Conflictos ──────────────────────────────────────────────────────────────

async function showStage(repo: string, stage: 1 | 2 | 3, path: string): Promise<string | null> {
  try {
    return await git(repo, ['show', `:${stage}:${path}`])
  } catch {
    return null // la versión no existe (archivo nuevo o borrado en un lado)
  }
}

export async function getConflictVersions(repo: string, path: string): Promise<ConflictVersions> {
  const working = existsSync(resolve(repo, path)) ? await readWorkingFile(repo, path) : ''
  const [base, ours, theirs] = await Promise.all([showStage(repo, 1, path), showStage(repo, 2, path), showStage(repo, 3, path)])
  const binary = [working, ours, theirs].some((text) => !!text && text.slice(0, 8000).includes('\0'))
  return { working, base, ours, theirs, binary }
}

export async function saveConflictResolution(repo: string, path: string, content: string): Promise<void> {
  const target = resolve(repo, path)
  const rel = relative(repo, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new GitError('Ruta fuera del repositorio')
  await writeFile(target, content, 'utf8')
  await git(repo, ['add', '--', rel])
}

// ── Staging y commits ───────────────────────────────────────────────────────

export async function stage(repo: string, paths: string[]): Promise<void> {
  if (paths.length) await git(repo, ['add', '-A', '--', ...paths])
}

export async function stageAll(repo: string): Promise<void> {
  await git(repo, ['add', '-A'])
}

export async function unstage(repo: string, paths: string[]): Promise<void> {
  if (!paths.length) return
  if (await hasHead(repo)) await git(repo, ['restore', '--staged', '--', ...paths])
  else await git(repo, ['rm', '--cached', '-r', '-q', '--', ...paths])
}

export async function unstageAll(repo: string): Promise<void> {
  if (await hasHead(repo)) await git(repo, ['reset', '-q'])
  else await git(repo, ['rm', '--cached', '-r', '-q', '.'])
}

export async function discard(repo: string, files: FileChange[]): Promise<void> {
  const tracked = files.filter((f) => f.status !== '?').map((f) => f.path)
  const untracked = files.filter((f) => f.status === '?').map((f) => f.path)
  if (tracked.length) await git(repo, ['restore', '--worktree', '--', ...tracked])
  if (untracked.length) await git(repo, ['clean', '-f', '-q', '--', ...untracked])
}

export async function discardAll(repo: string): Promise<void> {
  if (await hasHead(repo)) await git(repo, ['reset', '--hard', '-q'])
  await git(repo, ['clean', '-f', '-d', '-q'])
}

export async function applyPatch(repo: string, patch: string, cached: boolean, reverse: boolean): Promise<void> {
  const args = ['apply', '--recount', '--whitespace=nowarn']
  if (cached) args.push('--cached')
  if (reverse) args.push('--reverse')
  args.push('-')
  await git(repo, args, { input: patch })
}

export async function resolveConflict(repo: string, path: string, side: 'ours' | 'theirs'): Promise<void> {
  await git(repo, ['checkout', `--${side}`, '--', path])
  await git(repo, ['add', '--', path])
}

export async function commit(repo: string, message: string, amend: boolean): Promise<void> {
  if (!message.trim()) throw new GitError('El mensaje del commit está vacío')
  const args = ['commit', '--cleanup=strip', '-F', '-']
  if (amend) args.push('--amend')
  await git(repo, args, { input: message })
}

// ── Ramas, tags e historial ─────────────────────────────────────────────────

export async function checkout(repo: string, target: CheckoutTarget): Promise<void> {
  if (target.kind === 'commit') {
    await git(repo, ['checkout', '--detach', assertArg(target.hash, 'Commit')])
    return
  }
  if (target.kind === 'local') {
    await git(repo, ['checkout', assertArg(target.name, 'Rama'), '--'])
    return
  }
  const remoteName = assertArg(target.name, 'Rama')
  const local = remoteName.slice(remoteName.indexOf('/') + 1)
  const exists = (await git(repo, ['rev-parse', '--verify', '-q', `refs/heads/${local}`], { okCodes: [0, 1] })).trim()
  if (exists) await git(repo, ['checkout', local, '--'])
  else await git(repo, ['checkout', '-b', local, '--track', remoteName])
}

export async function createBranch(repo: string, name: string, start: string, doCheckout: boolean): Promise<void> {
  await assertBranchName(repo, name)
  assertArg(start, 'Punto de partida')
  if (doCheckout) await git(repo, ['checkout', '-b', name, start])
  else await git(repo, ['branch', name, start])
}

export async function renameBranch(repo: string, oldName: string, newName: string): Promise<void> {
  assertArg(oldName, 'Rama')
  await assertBranchName(repo, newName)
  await git(repo, ['branch', '-m', oldName, newName])
}

export async function deleteBranch(repo: string, name: string, force: boolean): Promise<void> {
  await git(repo, ['branch', force ? '-D' : '-d', assertArg(name, 'Rama')])
}

export async function deleteRemoteBranch(repo: string, remote: string, branch: string): Promise<void> {
  await git(repo, ['push', assertArg(remote, 'Remoto'), '--delete', assertArg(branch, 'Rama')])
}

export async function merge(repo: string, ref: string): Promise<void> {
  assertArg(ref, 'Referencia')
  // Con la referencia completa (sin ambigüedad con etiquetas) git pondría "refs/heads/…" en el mensaje: se arma como el suyo
  const kind = ref.startsWith('refs/heads/') ? 'branch' : ref.startsWith('refs/remotes/') ? 'remote-tracking branch' : null
  if (!kind) {
    await git(repo, ['merge', '--no-edit', ref])
    return
  }
  const name = ref.replace(/^refs\/(heads|remotes)\//, '')
  const into = await currentBranch(repo)
  const message = `Merge ${kind} '${name}'${into && into !== 'main' && into !== 'master' ? ` into ${into}` : ''}`
  await git(repo, ['merge', '--no-edit', '-m', message, ref])
}

export async function rebase(repo: string, onto: string): Promise<void> {
  await git(repo, ['rebase', assertArg(onto, 'Referencia')])
}

/** Commits que tiene `a` y no `b` (ahead) y al revés (behind). */
export async function divergence(repo: string, a: string, b: string): Promise<{ ahead: number; behind: number }> {
  const out = await git(repo, ['rev-list', '--left-right', '--count', `${assertArg(a, 'Referencia')}...${assertArg(b, 'Referencia')}`, '--'])
  const [ahead, behind] = out.trim().split(/\s+/).map(Number)
  return { ahead: ahead || 0, behind: behind || 0 }
}

/** Adelanta `branch` hasta `to` sin crear commits; falla si no es un avance directo. */
export async function fastForward(repo: string, branch: string, to: string): Promise<void> {
  await assertBranchName(repo, branch)
  assertArg(to, 'Referencia')
  if ((await currentBranch(repo)) === branch) {
    await git(repo, ['merge', '--ff-only', to])
    return
  }
  try {
    await git(repo, ['merge-base', '--is-ancestor', `refs/heads/${branch}`, to])
  } catch {
    throw new GitError(`${branch} tiene commits que no están en ${to}: no se puede hacer fast-forward.`)
  }
  await moveBranch(repo, branch, to)
}

/** Apunta una rama que no está en uso a otro commit (git se niega si está activa en algún worktree). */
export async function moveBranch(repo: string, branch: string, to: string): Promise<void> {
  await assertBranchName(repo, branch)
  await git(repo, ['branch', '-f', branch, assertArg(to, 'Referencia')])
}

export interface PushBranchOptions {
  /** --force-with-lease: sobrescribe solo si la remota sigue donde la vimos en el último fetch */
  force?: boolean
  setUpstream?: boolean
}

/** Sube una rama local concreta a `remote/remoteBranch`, esté o no activa. */
export async function pushBranch(repo: string, branch: string, remote: string, remoteBranch: string, options: PushBranchOptions = {}): Promise<void> {
  await assertBranchName(repo, branch)
  await assertBranchName(repo, remoteBranch)
  const remotes = (await git(repo, ['remote'])).split('\n').filter(Boolean)
  if (!remotes.includes(remote)) throw new GitError(`No existe el remoto ${remote}`)
  await git(repo, [
    'push',
    ...(options.force ? [`--force-with-lease=refs/heads/${remoteBranch}`] : []),
    ...(options.setUpstream ? ['-u'] : []),
    remote,
    `refs/heads/${branch}:refs/heads/${remoteBranch}`
  ])
}

const REBASE_LIMIT = 500

/**
 * Commits que reescribe un rebase interactivo, del más antiguo al más nuevo.
 * - `from`: desde ese commit (incluido) hasta HEAD, en el mismo sitio.
 * - `onto`: los de `tip` que no están en `base`, para llevarlos encima de `base` (como `git rebase -i base`).
 */
export async function getRebaseCommits(repo: string, base: string, mode: RebaseMode = 'from', tip = 'HEAD'): Promise<RebaseCommit[]> {
  assertArg(base, 'Commit')
  assertArg(tip, 'Rama')
  if (mode === 'from') {
    try {
      await git(repo, ['merge-base', '--is-ancestor', base, 'HEAD'])
    } catch {
      throw new GitError('Ese commit no está en la historia de la rama actual.')
    }
  }
  const range = await rebaseRange(repo, base, mode, tip)
  const merges = (await git(repo, ['rev-list', '--merges', '--count', ...range.revs])).trim()
  if (merges !== '0') throw new GitError('El rango tiene commits de merge: el rebase interactivo solo admite historia lineal.')
  const out = await git(repo, ['log', '--reverse', '--format=%H%x1f%an%x1f%ae%x1f%at%x1f%B%x1e', ...range.revs, '--'])
  const commits = out
    .split(RS)
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((record) => {
      const [hash, author, email, date, message] = record.split(FS)
      const text = (message ?? '').trimEnd()
      return { hash, author, email, date: Number(date) * 1000, subject: text.split('\n')[0], message: text }
    })
  if (commits.length > REBASE_LIMIT) throw new GitError(`Son ${commits.length} commits; el rebase interactivo admite hasta ${REBASE_LIMIT}.`)
  return commits
}

async function rebaseRange(repo: string, base: string, mode: RebaseMode, tip = 'HEAD'): Promise<{ revs: string[]; onto: string[] }> {
  // Igual que la lista que propone git: se omiten los commits que ya están (como cherry-pick) en la base
  if (mode === 'onto') return { revs: ['--cherry-pick', '--right-only', `${base}...${tip}`], onto: [base] }
  const parents = (await git(repo, ['rev-list', '--parents', '-n', '1', base])).trim().split(' ')
  if (parents.length === 1) return { revs: ['HEAD'], onto: ['--root'] }
  return { revs: [`${parents[1]}..HEAD`], onto: [parents[1]] }
}

/**
 * Convierte los pasos elegidos en la lista de tareas de `git rebase -i`, validando que sean
 * exactamente los commits del rango. Reescribir = pick + exec que cambia el mensaje desde un archivo.
 */
export function buildRebaseTodo(steps: RebaseStep[], commits: { hash: string }[], messageFile: (index: number) => string): string {
  const expected = new Set(commits.map((c) => c.hash))
  const seen = new Set<string>()
  for (const step of steps) {
    if (!expected.has(step.hash) || seen.has(step.hash)) throw new GitError('La lista de commits no coincide con la rama actual. Vuelve a abrir el rebase.')
    seen.add(step.hash)
    if (!['pick', 'reword', 'squash', 'fixup', 'drop'].includes(step.action)) throw new GitError(`Acción no válida: ${step.action}`)
    if (step.action === 'reword' && !step.message?.trim()) throw new GitError('El mensaje nuevo no puede quedar vacío.')
  }
  if (seen.size !== expected.size) throw new GitError('Faltan commits en la lista del rebase.')
  const first = steps.find((s) => s.action !== 'drop')
  if (first && (first.action === 'squash' || first.action === 'fixup')) throw new GitError('El primer commit que se conserva no puede combinarse con uno anterior.')
  const lines: string[] = []
  steps.forEach((step, i) => {
    if (step.action === 'reword') lines.push(`pick ${step.hash}`, `exec git commit --amend --allow-empty --no-verify --cleanup=strip -F '${messageFile(i)}'`)
    else lines.push(`${step.action} ${step.hash}`)
  })
  return lines.join('\n') + '\n'
}

export async function interactiveRebase(repo: string, base: string, steps: RebaseStep[], mode: RebaseMode = 'from'): Promise<void> {
  if ((await getRepoState(repo)).operation) throw new GitError('Hay otra operación en curso: termínala o abórtala primero.')
  const commits = await getRebaseCommits(repo, base, mode)
  const dir = await mkdtemp(join(tmpdir(), 'codyken-rebase-'))
  if (dir.includes("'")) throw new GitError('Ruta temporal no válida')
  const messageFile = (i: number): string => join(dir, `mensaje-${i}.txt`)
  const todo = buildRebaseTodo(steps, commits, messageFile)
  await Promise.all(steps.map((s, i) => (s.action === 'reword' ? writeFile(messageFile(i), s.message!.trim() + '\n', 'utf8') : null)))
  await writeFile(join(dir, 'todo'), todo, 'utf8')
  const { onto } = await rebaseRange(repo, base, mode)
  try {
    // git ejecuta GIT_SEQUENCE_EDITOR con la ruta de su lista: la reemplazamos por la nuestra
    await git(repo, ['rebase', '-i', '--autostash', ...onto], { env: { GIT_SEQUENCE_EDITOR: `cp '${join(dir, 'todo')}'` } })
  } catch (error) {
    if ((await getRepoState(repo)).operation === 'rebase') {
      // Los exec pendientes leen los mensajes de esta carpeta: se conserva hasta que termine el rebase
      throw new GitError(`El rebase se detuvo: resuelve los conflictos y pulsa Continuar, o Abortar para volver atrás.\n\n${error instanceof Error ? error.message : String(error)}`)
    }
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  await rm(dir, { recursive: true, force: true })
}

export async function cherryPick(repo: string, hash: string, isMerge: boolean): Promise<void> {
  await git(repo, ['cherry-pick', ...(isMerge ? ['-m', '1'] : []), assertArg(hash, 'Commit')])
}

export async function revert(repo: string, hash: string, isMerge: boolean): Promise<void> {
  await git(repo, ['revert', '--no-edit', ...(isMerge ? ['-m', '1'] : []), assertArg(hash, 'Commit')])
}

export async function reset(repo: string, hash: string, mode: ResetMode): Promise<void> {
  await git(repo, ['reset', `--${mode}`, assertArg(hash, 'Commit')])
}

export async function createTag(repo: string, name: string, hash: string, message: string): Promise<void> {
  assertArg(name, 'Etiqueta')
  try {
    await git(repo, ['check-ref-format', `refs/tags/${name}`])
  } catch {
    throw new GitError(`"${name}" no es un nombre de etiqueta válido`)
  }
  if (message.trim()) await git(repo, ['tag', '-a', name, assertArg(hash, 'Commit'), '-F', '-'], { input: message })
  else await git(repo, ['tag', name, assertArg(hash, 'Commit')])
}

export async function deleteTag(repo: string, name: string): Promise<void> {
  await git(repo, ['tag', '-d', assertArg(name, 'Etiqueta')])
}

// ── Worktrees ───────────────────────────────────────────────────────────────

export function parseWorktrees(out: string): Worktree[] {
  const list: Worktree[] = []
  for (const block of out.split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean)
    if (!lines[0]?.startsWith('worktree ')) continue
    const tree: Worktree = { path: lines[0].slice(9), head: null, branch: null, detached: false, bare: false, locked: false, prunable: false, isMain: list.length === 0 }
    for (const line of lines.slice(1)) {
      if (line.startsWith('HEAD ')) tree.head = line.slice(5)
      else if (line.startsWith('branch ')) tree.branch = line.slice(7).replace(/^refs\/heads\//, '')
      else if (line === 'detached') tree.detached = true
      else if (line === 'bare') tree.bare = true
      else if (line === 'locked' || line.startsWith('locked ')) tree.locked = true
      else if (line === 'prunable' || line.startsWith('prunable ')) tree.prunable = true
    }
    list.push(tree)
  }
  return list
}

export async function getWorktrees(repo: string): Promise<Worktree[]> {
  return parseWorktrees(await git(repo, ['worktree', 'list', '--porcelain']))
}

export async function addWorktree(repo: string, path: string, branch: string, newBranch: boolean): Promise<string> {
  if (!isAbsolute(path) || path.includes('\0')) throw new GitError(`Ruta no válida: ${path}`)
  if (existsSync(path)) throw new GitError(`Ya existe la carpeta ${path}`)
  if (!existsSync(dirname(path))) throw new GitError(`No existe la carpeta ${dirname(path)}`)
  await assertBranchName(repo, branch)
  if (newBranch) await git(repo, ['worktree', 'add', '-b', branch, '--', path, 'HEAD'])
  else await git(repo, ['worktree', 'add', '--', path, branch])
  return resolveRepo(path)
}

export async function removeWorktree(repo: string, path: string, force: boolean): Promise<void> {
  const known = await getWorktrees(repo)
  const tree = known.find((w) => w.path === path)
  if (!tree) throw new GitError('Ese worktree no pertenece a este repositorio')
  if (tree.isMain) throw new GitError('No se puede eliminar el worktree principal')
  await git(repo, ['worktree', 'remove', ...(force ? ['--force'] : []), '--', path])
}

export async function pruneWorktrees(repo: string): Promise<void> {
  await git(repo, ['worktree', 'prune'])
}

// ── Git LFS ─────────────────────────────────────────────────────────────────

/** Salida de `git lfs track` sin argumentos: líneas "    *.psd (.gitattributes)" */
export function parseLfsTrack(out: string): LfsInfo['patterns'] {
  const patterns: LfsInfo['patterns'] = []
  for (const line of out.split('\n')) {
    const match = /^\s+(.+?) \((.+)\)$/.exec(line)
    if (match) patterns.push({ pattern: match[1], source: match[2] })
  }
  return patterns
}

/** Salida de `git lfs ls-files --long`: "<oid> * ruta" (descargado) o "<oid> - ruta" (solo el puntero) */
export function parseLfsFiles(out: string): LfsInfo['files'] {
  const files: LfsInfo['files'] = []
  for (const line of out.split('\n')) {
    const match = /^([0-9a-f]{7,64}) ([*-]) (.+)$/.exec(line)
    if (match) files.push({ oid: match[1], downloaded: match[2] === '*', path: match[3] })
  }
  return files
}

export function parseLfsAttributes(text: string): LfsInfo['patterns'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && /\sfilter=lfs(\s|$)/.test(line))
    .map((line) => ({ pattern: line.split(/\s+/)[0], source: '.gitattributes' }))
}

export async function getLfsInfo(repo: string): Promise<LfsInfo> {
  let version: string
  try {
    version = (await git(repo, ['lfs', 'version'])).trim()
  } catch {
    // Sin git-lfs: igual se avisa si el repo lo usa, leyendo .gitattributes
    const attributes = await readFile(join(repo, '.gitattributes'), 'utf8').catch(() => '')
    return { installed: false, version: null, patterns: parseLfsAttributes(attributes), files: [] }
  }
  const patterns = parseLfsTrack(await git(repo, ['lfs', 'track']).catch(() => ''))
  const files = patterns.length ? parseLfsFiles(await git(repo, ['lfs', 'ls-files', '--long']).catch(() => '')) : []
  return { installed: true, version, patterns, files }
}

function assertPattern(pattern: string): string {
  if (!pattern.trim() || pattern.startsWith('-') || /[\0\n]/.test(pattern)) throw new GitError(`Patrón no válido: ${pattern}`)
  return pattern.trim()
}

export async function lfsTrack(repo: string, pattern: string): Promise<void> {
  await git(repo, ['lfs', 'track', '--', assertPattern(pattern)])
}

export async function lfsUntrack(repo: string, pattern: string): Promise<void> {
  await git(repo, ['lfs', 'untrack', '--', assertPattern(pattern)])
}

export async function lfsPull(repo: string): Promise<void> {
  await git(repo, ['lfs', 'pull'])
}

// ── Remotos ─────────────────────────────────────────────────────────────────

/**
 * Trae todos los remotos (y la historia completa si el clon era superficial) y después adelanta las ramas
 * locales que solo están atrasadas respecto a su remota: `git fetch` por sí solo nunca mueve las ramas locales.
 * No se tocan las que tienen commits propios, las activas en otro worktree ni, salvo `updateCurrent`, la actual.
 */
export async function fetch(repo: string, options: { updateCurrent?: boolean } = {}): Promise<FetchResult> {
  const shallow = (await git(repo, ['rev-parse', '--is-shallow-repository'])).trim() === 'true'
  await git(repo, ['fetch', '--all', '--prune', '--quiet', ...(shallow ? ['--unshallow'] : [])])
  const result: FetchResult = { updated: [], diverged: [], skipped: [], unshallowed: shallow }

  const [refs, state, worktrees] = await Promise.all([getRefs(repo), getRepoState(repo), getWorktrees(repo).catch(() => [])])
  const elsewhere = new Map(worktrees.filter((w) => w.branch && w.branch !== state.branch).map((w) => [w.branch!, w.path]))
  // Nombre completo de cada upstream (`refs/heads/x@{upstream}` no es una sintaxis válida)
  const upstreams = new Map(
    (await git(repo, ['for-each-ref', '--format=%(refname)%1f%(upstream)', 'refs/heads']))
      .split('\n')
      .map((line) => line.split(FS))
      .filter(([, upstream]) => upstream)
      .map(([name, upstream]) => [name, upstream] as const)
  )
  for (const ref of refs) {
    if (ref.type !== 'local' || !ref.upstream || ref.gone || !ref.behind) continue
    if (ref.ahead) {
      result.diverged.push(ref.name)
      continue
    }
    const upstream = upstreams.get(ref.fullName)
    const to = upstream ? (await git(repo, ['rev-parse', '--verify', '-q', `${upstream}^{commit}`], { okCodes: [0, 1] })).trim() : ''
    if (!to) continue
    if (elsewhere.has(ref.name)) {
      result.skipped.push({ branch: ref.name, reason: `está activa en el worktree ${basename(elsewhere.get(ref.name)!)}` })
      continue
    }
    try {
      if (ref.isHead) {
        if (!options.updateCurrent) continue
        if (state.operation) {
          result.skipped.push({ branch: ref.name, reason: 'hay una operación en curso' })
          continue
        }
        // Rechaza el avance si pisaría cambios sin confirmar
        await git(repo, ['merge', '--ff-only', '--quiet', to])
      } else {
        await git(repo, ['update-ref', '-m', `codyken: fetch, fast-forward a ${ref.upstream}`, ref.fullName, to, ref.hash])
      }
      result.updated.push({ branch: ref.name, from: ref.hash, to, current: !!ref.isHead })
    } catch (error) {
      const reason = ref.isHead ? 'tus cambios sin confirmar lo impiden' : error instanceof Error ? error.message.split('\n')[0] : String(error)
      result.skipped.push({ branch: ref.name, reason })
    }
  }
  return result
}

export async function pull(repo: string, mode: PullMode): Promise<void> {
  const flag = mode === 'rebase' ? '--rebase' : mode === 'ff-only' ? '--ff-only' : '--no-rebase'
  await git(repo, ['pull', flag])
}

export async function push(repo: string, force: boolean): Promise<void> {
  const branch = await currentBranch(repo)
  if (!branch) throw new GitError('No estás en ninguna rama (HEAD desacoplado).')
  const upstream = await git(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { okCodes: [0, 128] })
  const forceArgs = force ? ['--force-with-lease'] : []
  if (upstream.trim()) {
    await git(repo, ['push', ...forceArgs])
    return
  }
  const remotes = (await git(repo, ['remote'])).split('\n').filter(Boolean)
  if (!remotes.length) throw new GitError('Este repositorio no tiene remotos configurados.')
  const remote = remotes.includes('origin') ? 'origin' : remotes[0]
  await git(repo, ['push', ...forceArgs, '-u', remote, branch])
}

// ── Stash ───────────────────────────────────────────────────────────────────

export async function stashPush(repo: string, message: string): Promise<void> {
  const out = await git(repo, ['stash', 'push', '-u', ...(message.trim() ? ['-m', message.trim()] : [])])
  if (out.includes('No local changes')) throw new GitError('No hay cambios para guardar en el stash.')
}

export async function stashApply(repo: string, index: number, pop: boolean): Promise<void> {
  await git(repo, ['stash', pop ? 'pop' : 'apply', `stash@{${Math.trunc(index)}}`])
}

export async function stashDrop(repo: string, index: number): Promise<void> {
  await git(repo, ['stash', 'drop', `stash@{${Math.trunc(index)}}`])
}

// ── Operaciones en curso ────────────────────────────────────────────────────

export async function abortOperation(repo: string, op: RepoOperation): Promise<void> {
  await git(repo, [op, '--abort'])
}

export async function continueOperation(repo: string, op: RepoOperation): Promise<void> {
  if (op === 'merge') await git(repo, ['commit', '--no-edit'])
  else await git(repo, [op, '--continue'])
}
