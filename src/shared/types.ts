export interface Commit {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  subject: string
  /** Solo en las filas de stash que se intercalan en el gráfico */
  stash?: number
}

export interface GraphFilter {
  /** Referencias completas (`refs/heads/x`, `refs/remotes/origin/x`) que no se dibujan */
  hidden: string[]
  /** Si no está vacío, solo se dibujan estas referencias (y HEAD) */
  solo: string[]
}

export interface Remote {
  name: string
  url: string
  host: string
}

export interface FileHistoryEntry extends Commit {
  path: string
  oldPath?: string
  status: FileStatus
}

export interface BlameLine {
  hash: string
  author: string
  email: string
  date: number
  summary: string
  line: number
  text: string
}

export type RefType = 'local' | 'remote' | 'tag'

export interface Ref {
  type: RefType
  /** Nombre corto: `main`, `origin/main`, `v1.0` */
  name: string
  fullName: string
  hash: string
  remote?: string
  upstream?: string
  ahead?: number
  behind?: number
  gone?: boolean
  isHead?: boolean
}

export interface StashEntry {
  index: number
  hash: string
  /** Commit sobre el que se guardó el stash */
  base: string
  author: string
  email: string
  date: number
  message: string
}

export type FileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?'

export interface FileChange {
  path: string
  oldPath?: string
  status: FileStatus
  /** Archivo nuevo de un stash: vive en el commit interno de no rastreados, no en el stash */
  commit?: string
}

export interface WorkingStatus {
  staged: FileChange[]
  unstaged: FileChange[]
  conflicted: FileChange[]
}

export type RepoOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

export interface RepoState {
  root: string
  head: string | null
  branch: string | null
  detached: boolean
  operation: RepoOperation | null
}

export interface CommitDetail {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  committer: string
  committerEmail: string
  committerDate: number
  message: string
  files: FileChange[]
}

export type DiffSource =
  | { kind: 'unstaged'; path: string; status: FileStatus }
  | { kind: 'staged'; path: string; oldPath?: string; status: FileStatus }
  | { kind: 'conflict'; path: string }
  | { kind: 'commit'; hash: string; parent: string | null; path: string; oldPath?: string; status: FileStatus }

export type PullMode = 'merge' | 'ff-only' | 'rebase'
export type ResetMode = 'soft' | 'mixed' | 'hard'
export type DiffMode = 'hunk' | 'file' | 'split'
export type ColumnId = 'refs' | 'graph' | 'message' | 'author' | 'date' | 'sha'

export type CheckoutTarget =
  | { kind: 'local'; name: string }
  | { kind: 'remote'; name: string }
  | { kind: 'commit'; hash: string }

export interface RecentRepo {
  path: string
  /** false si la carpeta se movió o se borró */
  exists: boolean
}

export interface Settings {
  recent: string[]
  tabs: (string | null)[]
  activeTab: number
  pullMode: PullMode
  columns: ColumnId[]
  leftWidth: number
  rightWidth: number
  leftVisible: boolean
  rightVisible: boolean
  diffMode: DiffMode
  wrap: boolean
  autoFetchMinutes: number
  fileView: 'list' | 'tree'
  graphFilters: Record<string, GraphFilter>
}

export interface MenuItemSpec {
  id?: string
  label?: string
  type?: 'normal' | 'separator' | 'checkbox' | 'radio'
  checked?: boolean
  enabled?: boolean
  accelerator?: string
  submenu?: MenuItemSpec[]
}

export interface ConfirmOptions {
  message: string
  detail?: string
  confirmLabel: string
  destructive?: boolean
}

export interface RepoChangedEvent {
  repo: string
  refs: boolean
}

export interface Api {
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  pickDirectory(title: string): Promise<string | null>
  confirm(options: ConfirmOptions): Promise<boolean>
  contextMenu(items: MenuItemSpec[]): Promise<string | null>
  copyText(text: string): Promise<void>
  openTerminal(path: string): Promise<void>
  openInFinder(path: string): Promise<void>
  watchRepo(repo: string): Promise<void>
  unwatchRepo(repo: string): Promise<void>

  /** Valida la carpeta y la registra como abierta; con addToRecent=false no la sube en la lista de recientes. */
  resolveRepo(path: string, addToRecent?: boolean): Promise<string>
  getRecentRepos(): Promise<RecentRepo[]>
  removeRecent(paths: string[]): Promise<string[]>
  initRepo(path: string): Promise<string>
  cloneRepo(url: string, parentDir: string): Promise<string>

  getLog(repo: string, limit: number, filter: GraphFilter): Promise<Commit[]>
  getRemotes(repo: string): Promise<Remote[]>
  getFileHistory(repo: string, path: string, limit: number): Promise<FileHistoryEntry[]>
  getBlame(repo: string, path: string, rev: string | null): Promise<BlameLine[]>
  getRefs(repo: string): Promise<Ref[]>
  getRepoState(repo: string): Promise<RepoState>
  getStatus(repo: string): Promise<WorkingStatus>
  getStashes(repo: string): Promise<StashEntry[]>
  getSubmodules(repo: string): Promise<string[]>
  getCommitDetail(repo: string, hash: string): Promise<CommitDetail>
  getDiff(repo: string, source: DiffSource, full: boolean): Promise<string>
  readWorkingFile(repo: string, path: string): Promise<string>
  getLastCommitMessage(repo: string): Promise<string>

  stage(repo: string, paths: string[]): Promise<void>
  stageAll(repo: string): Promise<void>
  unstage(repo: string, paths: string[]): Promise<void>
  unstageAll(repo: string): Promise<void>
  discard(repo: string, files: FileChange[]): Promise<void>
  discardAll(repo: string): Promise<void>
  applyPatch(repo: string, patch: string, cached: boolean, reverse: boolean): Promise<void>
  resolveConflict(repo: string, path: string, side: 'ours' | 'theirs'): Promise<void>
  commit(repo: string, message: string, amend: boolean): Promise<void>

  checkout(repo: string, target: CheckoutTarget): Promise<void>
  createBranch(repo: string, name: string, start: string, checkout: boolean): Promise<void>
  renameBranch(repo: string, oldName: string, newName: string): Promise<void>
  deleteBranch(repo: string, name: string, force: boolean): Promise<void>
  deleteRemoteBranch(repo: string, remote: string, branch: string): Promise<void>
  merge(repo: string, ref: string): Promise<void>
  rebase(repo: string, onto: string): Promise<void>
  cherryPick(repo: string, hash: string, isMerge: boolean): Promise<void>
  revert(repo: string, hash: string, isMerge: boolean): Promise<void>
  reset(repo: string, hash: string, mode: ResetMode): Promise<void>
  createTag(repo: string, name: string, hash: string, message: string): Promise<void>
  deleteTag(repo: string, name: string): Promise<void>

  fetch(repo: string): Promise<void>
  pull(repo: string, mode: PullMode): Promise<void>
  push(repo: string, force: boolean): Promise<void>

  stashPush(repo: string, message: string): Promise<void>
  stashApply(repo: string, index: number, pop: boolean): Promise<void>
  stashDrop(repo: string, index: number): Promise<void>

  abortOperation(repo: string, op: RepoOperation): Promise<void>
  continueOperation(repo: string, op: RepoOperation): Promise<void>
}

export type ApiResult = { ok: true; data: unknown } | { ok: false; error: string }

export interface Bridge {
  invoke(method: string, args: unknown[]): Promise<ApiResult>
  onRepoChanged(callback: (event: RepoChangedEvent) => void): () => void
  platform: string
}
