import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell, type MenuItemConstructorOptions } from 'electron'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Api, ApiResult, MenuItemSpec } from '../shared/types'
import * as gitOps from './git'
import { checkoutPullRequest, getPullRequests } from './integrations'
import { addRecent, getRecentRepos, getSettings, removeRecent, updateSettings } from './settings'
import { RepoWatchers } from './watcher'

const snapshotPath = !app.isPackaged ? process.env.CODYKEN_SNAPSHOT : undefined
if (snapshotPath) app.setPath('userData', join(tmpdir(), 'codyken-snapshot'))

let mainWindow: BrowserWindow | null = null
const knownRepos = new Set<string>()
const watchers = new RepoWatchers((event) => mainWindow?.webContents.send('codyken:repo-changed', event))

function repo(path: string): string {
  if (!knownRepos.has(path)) throw new gitOps.GitError('Repositorio no abierto en Codyken')
  return path
}

async function remember(path: string, addToRecent = true): Promise<string> {
  knownRepos.add(path)
  if (addToRecent) addRecent(path)
  return path
}

function buildMenu(items: MenuItemSpec[], choose: (id: string) => void): Menu {
  const toOptions = (spec: MenuItemSpec): MenuItemConstructorOptions => {
    if (spec.type === 'separator') return { type: 'separator' }
    return {
      label: spec.label,
      type: spec.submenu ? 'submenu' : spec.type ?? 'normal',
      checked: spec.checked,
      enabled: spec.enabled ?? true,
      accelerator: spec.accelerator,
      submenu: spec.submenu ? spec.submenu.map(toOptions) : undefined,
      click: spec.id ? () => choose(spec.id!) : undefined
    }
  }
  return Menu.buildFromTemplate(items.map(toOptions))
}

type Handlers = {
  [K in keyof Api]: (win: BrowserWindow, ...args: Parameters<Api[K]>) => ReturnType<Api[K]> | Awaited<ReturnType<Api[K]>>
}

const handlers: Handlers = {
  getSettings: () => getSettings(),
  updateSettings: (_w, patch) => updateSettings(patch),
  pickDirectory: async (win, title) => {
    const result = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0] ?? null
  },
  confirm: async (win, options) => {
    // Modo captura: los diálogos nativos bloquean el guion, así que se aceptan solos
    if (snapshotPath && process.env.CODYKEN_SNAPSHOT_CONFIRM === '1') return true
    const result = await dialog.showMessageBox(win, {
      type: options.destructive ? 'warning' : 'question',
      message: options.message,
      detail: options.detail,
      buttons: [options.confirmLabel, 'Cancelar'],
      defaultId: options.destructive ? 1 : 0,
      cancelId: 1
    })
    return result.response === 0
  },
  contextMenu: (win, items) =>
    new Promise((resolve) => {
      // Modo captura: el menú nativo no sale en la captura; se registra y se elige la opción que contenga el texto dado
      const pick = snapshotPath ? process.env.CODYKEN_SNAPSHOT_MENU : undefined
      if (pick !== undefined) {
        const flat = (list: MenuItemSpec[]): MenuItemSpec[] => list.flatMap((i) => [i, ...flat(i.submenu ?? [])])
        const options = flat(Array.isArray(items) ? items : []).filter((i) => i.type !== 'separator')
        console.log(`[menu] ${JSON.stringify(options.map((i) => (i.enabled === false ? `(${i.label})` : i.label)))}`)
        return resolve(options.find((i) => i.enabled !== false && pick && i.label?.includes(pick))?.id ?? null)
      }
      let done = false
      const finish = (id: string | null): void => {
        if (done) return
        done = true
        resolve(id)
      }
      buildMenu(items, finish).popup({ window: win, callback: () => setTimeout(() => finish(null), 50) })
    }),
  copyText: (_w, text) => clipboard.writeText(text),
  openTerminal: (_w, path) => {
    if (process.platform === 'darwin') spawn('open', ['-a', 'Terminal', repo(path)], { detached: true }).unref()
    else void shell.openPath(repo(path))
  },
  openInFinder: async (_w, path) => {
    await shell.openPath(repo(path))
  },
  watchRepo: async (_w, path) => watchers.watch(repo(path), await gitOps.getGitDir(path)),
  unwatchRepo: (_w, path) => watchers.unwatch(path),

  resolveRepo: async (_w, path, addToRecent) => remember(await gitOps.resolveRepo(path), addToRecent !== false),
  getRecentRepos: () => getRecentRepos(),
  removeRecent: (_w, paths) => removeRecent(Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string') : []),
  initRepo: async (_w, path) => remember(await gitOps.initRepo(path)),
  cloneRepo: async (_w, url, parentDir) => remember(await gitOps.cloneRepo(url, parentDir)),

  getLog: (_w, r, limit, filter) => gitOps.getLog(repo(r), limit, filter),
  getRemotes: (_w, r) => gitOps.getRemotes(repo(r)),
  getFileHistory: (_w, r, path, limit) => gitOps.getFileHistory(repo(r), path, limit),
  getBlame: (_w, r, path, rev) => gitOps.getBlame(repo(r), path, rev),
  getRefs: (_w, r) => gitOps.getRefs(repo(r)),
  getRepoState: (_w, r) => gitOps.getRepoState(repo(r)),
  getStatus: (_w, r) => gitOps.getStatus(repo(r)),
  getStashes: (_w, r) => gitOps.getStashes(repo(r)),
  getSubmodules: (_w, r) => gitOps.getSubmodules(repo(r)),
  getCommitDetail: (_w, r, hash) => gitOps.getCommitDetail(repo(r), hash),
  getDiff: (_w, r, source, full) => gitOps.getDiff(repo(r), source, full),
  readWorkingFile: (_w, r, path) => gitOps.readWorkingFile(repo(r), path),
  getLastCommitMessage: (_w, r) => gitOps.getLastCommitMessage(repo(r)),
  compareRefs: (_w, r, base, target) => gitOps.compareRefs(repo(r), base, target),
  getRebaseCommits: (_w, r, base, mode, tip) => gitOps.getRebaseCommits(repo(r), base, mode === 'onto' ? 'onto' : 'from', typeof tip === 'string' ? tip : 'HEAD'),
  divergence: (_w, r, a, b) => gitOps.divergence(repo(r), a, b),
  getConflictVersions: (_w, r, path) => gitOps.getConflictVersions(repo(r), path),
  getWorktrees: (_w, r) => gitOps.getWorktrees(repo(r)),
  getLfsInfo: (_w, r) => gitOps.getLfsInfo(repo(r)),
  getPullRequests: (_w, r) => getPullRequests(repo(r)),

  stage: (_w, r, paths) => gitOps.stage(repo(r), paths),
  stageAll: (_w, r) => gitOps.stageAll(repo(r)),
  unstage: (_w, r, paths) => gitOps.unstage(repo(r), paths),
  unstageAll: (_w, r) => gitOps.unstageAll(repo(r)),
  discard: (_w, r, files) => gitOps.discard(repo(r), files),
  discardAll: (_w, r) => gitOps.discardAll(repo(r)),
  applyPatch: (_w, r, patch, cached, reverse) => gitOps.applyPatch(repo(r), patch, cached, reverse),
  resolveConflict: (_w, r, path, side) => gitOps.resolveConflict(repo(r), path, side),
  commit: (_w, r, message, amend) => gitOps.commit(repo(r), message, amend),
  saveConflictResolution: (_w, r, path, content) => gitOps.saveConflictResolution(repo(r), path, String(content)),
  readEditable: (_w, r, path, target, patch, rev) =>
    gitOps.readEditable(repo(r), String(path), target === 'index' ? 'index' : 'working', typeof patch === 'string' ? patch : undefined, typeof rev === 'string' ? rev : undefined),
  writeEditable: (_w, r, path, target, content, version, force) =>
    gitOps.writeEditable(repo(r), String(path), target === 'index' ? 'index' : 'working', String(content), String(version ?? ''), force === true),

  checkout: (_w, r, target) => gitOps.checkout(repo(r), target),
  createBranch: (_w, r, name, start, checkout) => gitOps.createBranch(repo(r), name, start, checkout),
  renameBranch: (_w, r, oldName, newName) => gitOps.renameBranch(repo(r), oldName, newName),
  deleteBranch: (_w, r, name, force) => gitOps.deleteBranch(repo(r), name, force),
  deleteRemoteBranch: (_w, r, remote, branch) => gitOps.deleteRemoteBranch(repo(r), remote, branch),
  merge: (_w, r, ref) => gitOps.merge(repo(r), ref),
  rebase: (_w, r, onto) => gitOps.rebase(repo(r), onto),
  interactiveRebase: (_w, r, base, steps, mode) => gitOps.interactiveRebase(repo(r), base, Array.isArray(steps) ? steps : [], mode === 'onto' ? 'onto' : 'from'),
  fastForward: (_w, r, branch, to) => gitOps.fastForward(repo(r), branch, to),
  moveBranch: (_w, r, branch, to) => gitOps.moveBranch(repo(r), branch, to),
  cherryPick: (_w, r, hash, isMerge) => gitOps.cherryPick(repo(r), hash, isMerge),
  revert: (_w, r, hash, isMerge) => gitOps.revert(repo(r), hash, isMerge),
  reset: (_w, r, hash, mode) => gitOps.reset(repo(r), hash, mode),
  createTag: (_w, r, name, hash, message) => gitOps.createTag(repo(r), name, hash, message),
  deleteTag: (_w, r, name) => gitOps.deleteTag(repo(r), name),

  fetch: (_w, r, options) => gitOps.fetch(repo(r), { updateCurrent: options?.updateCurrent === true }),
  pull: (_w, r, mode) => gitOps.pull(repo(r), mode),
  push: (_w, r, force) => gitOps.push(repo(r), force),
  pushBranch: (_w, r, branch, remote, remoteBranch, options) =>
    gitOps.pushBranch(repo(r), branch, remote, remoteBranch, { force: options?.force === true, setUpstream: options?.setUpstream === true }),

  addWorktree: async (_w, r, path, branch, newBranch) => remember(await gitOps.addWorktree(repo(r), path, branch, !!newBranch)),
  removeWorktree: (_w, r, path, force) => gitOps.removeWorktree(repo(r), path, !!force),
  pruneWorktrees: (_w, r) => gitOps.pruneWorktrees(repo(r)),

  lfsTrack: (_w, r, pattern) => gitOps.lfsTrack(repo(r), pattern),
  lfsUntrack: (_w, r, pattern) => gitOps.lfsUntrack(repo(r), pattern),
  lfsPull: (_w, r) => gitOps.lfsPull(repo(r)),

  checkoutPullRequest: (_w, r, number) => checkoutPullRequest(repo(r), Number(number)),
  openExternal: async (_w, url) => {
    if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url)) throw new gitOps.GitError('Solo se abren enlaces https')
    await shell.openExternal(url)
  },

  stashPush: (_w, r, message) => gitOps.stashPush(repo(r), message),
  stashApply: (_w, r, index, pop) => gitOps.stashApply(repo(r), index, pop),
  stashDrop: (_w, r, index) => gitOps.stashDrop(repo(r), index),

  abortOperation: (_w, r, op) => gitOps.abortOperation(repo(r), op),
  continueOperation: (_w, r, op) => gitOps.continueOperation(repo(r), op)
}

ipcMain.handle('codyken:api', async (event, method: string, args: unknown[]): Promise<ApiResult> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win !== mainWindow || !Object.hasOwn(handlers, method)) return { ok: false, error: 'Llamada no permitida' }
  try {
    const handler = handlers[method as keyof Api] as (w: BrowserWindow, ...a: unknown[]) => unknown
    return { ok: true, data: await handler(win, ...(Array.isArray(args) ? args : [])) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

function setAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `Acerca de ${app.name}` },
              { type: 'separator' },
              { role: 'services', label: 'Servicios' },
              { type: 'separator' },
              { role: 'hide', label: `Ocultar ${app.name}` },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: `Salir de ${app.name}` }
            ]
          } as MenuItemConstructorOptions
        ]
      : []),
    { role: 'editMenu', label: 'Edición' },
    {
      label: 'Ver',
      submenu: [
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomIn', accelerator: 'CommandOrControl+=', visible: false },
        { role: 'zoomOut', label: 'Alejar' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(!app.isPackaged ? [{ role: 'reload' } as MenuItemConstructorOptions, { role: 'toggleDevTools' } as MenuItemConstructorOptions] : [])
      ]
    },
    { role: 'windowMenu', label: 'Ventana' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Icono de la app (lo genera scripts/icon.cjs a partir del logo) */
const appIcon = (): Electron.NativeImage => nativeImage.createFromPath(join(app.getAppPath(), 'resources/icon.png'))

/** En modo captura, `CODYKEN_SNAPSHOT_SIZE=1100x720` cambia el tamaño de la ventana */
const snapshotSize = (): { width: number; height: number } => {
  const match = snapshotPath ? /^(\d+)x(\d+)$/.exec(process.env.CODYKEN_SNAPSHOT_SIZE ?? '') : null
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1440, height: 900 }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...snapshotSize(),
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'Codyken',
    icon: process.platform === 'darwin' ? undefined : appIcon(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 12 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1016' : '#f6f7fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (!snapshotPath) mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    watchers.closeAll()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  if (snapshotPath) {
    // En capturas la consola del renderer va a stdout, para ver errores sin abrir las DevTools
    mainWindow.webContents.on('console-message', (event) => console.log(`[renderer] ${event.message}`))
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (!mainWindow) return
        const script = process.env.CODYKEN_SNAPSHOT_JS
        if (script) {
          await mainWindow.webContents.executeJavaScript(script).catch((e) => console.error('snapshot js:', e))
          await new Promise((r) => setTimeout(r, Number(process.env.CODYKEN_SNAPSHOT_SETTLE ?? 1200)))
        }
        const image = await mainWindow.webContents.capturePage()
        writeFileSync(snapshotPath, image.toPNG())
        app.quit()
      }, Number(process.env.CODYKEN_SNAPSHOT_DELAY ?? 2500))
    })
  }

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  app.setName('Codyken')
  app.setAboutPanelOptions({ applicationName: 'Codyken', applicationVersion: app.getVersion(), version: '', copyright: 'Cliente Git de escritorio' })
  // Sin empaquetar, macOS muestra el icono de Electron en el Dock: se reemplaza al arrancar.
  // Empaquetada usa el .icns del bundle (scripts/package-mac.sh)
  if (process.platform === 'darwin' && !app.isPackaged) {
    const icon = appIcon()
    if (!icon.isEmpty()) app.dock?.setIcon(icon)
  }
  const open = snapshotPath ? process.env.CODYKEN_OPEN : undefined
  if (open) {
    const root = await remember(await gitOps.resolveRepo(open))
    updateSettings({ tabs: [root], activeTab: 0 })
  }
  // Los repos de las pestañas guardadas se validan al abrirse desde el renderer
  setAppMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || snapshotPath) app.quit()
})
