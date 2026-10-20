import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, join, relative, resolve, isAbsolute } from 'node:path'
import type {
  CheckoutTarget,
  BlameLine,
  Commit,
  CommitDetail,
  DiffSource,
  FileChange,
  FileHistoryEntry,
  FileStatus,
  GraphFilter,
  PullMode,
  Ref,
  Remote,
  RepoOperation,
  RepoState,
  ResetMode,
  StashEntry,
  WorkingStatus
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

const ENV = buildEnv()
const FS = '\x1f'
const RS = '\x1e'

interface RunOptions {
  input?: string
  okCodes?: number[]
}

export function git(cwd: string, args: string[], options: RunOptions = {}): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args], { cwd, env: ENV })
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
  const commits: Commit[] = []
  for (const record of out.split(RS)) {
    const line = record.replace(/^\n/, '')
    if (line) commits.push(parseCommitFields(line.split(FS)))
  }
  return commits
}

export async function getRemotes(repo: string): Promise<Remote[]> {
  const out = await git(repo, ['remote', '-v'])
  const remotes = new Map<string, Remote>()
  for (const line of out.split('\n')) {
    const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line)
    if (!match) continue
    const [, name, url] = match
    const host = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(url)?.[1] ?? ''
    remotes.set(name, { name, url, host: url.startsWith('/') || url.startsWith('.') ? 'local' : host })
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
  await git(repo, ['merge', '--no-edit', assertArg(ref, 'Referencia')])
}

export async function rebase(repo: string, onto: string): Promise<void> {
  await git(repo, ['rebase', assertArg(onto, 'Referencia')])
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

// ── Remotos ─────────────────────────────────────────────────────────────────

export async function fetch(repo: string): Promise<void> {
  await git(repo, ['fetch', '--all', '--prune', '--quiet'])
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
