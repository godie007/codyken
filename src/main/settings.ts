import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pushRecent, withoutRecent } from '../shared/recent'
import type { RecentRepo, Settings } from '../shared/types'

const DEFAULTS: Settings = {
  recent: [],
  tabs: [],
  activeTab: 0,
  pullMode: 'merge',
  columns: ['refs', 'graph', 'message', 'author', 'date'],
  leftWidth: 250,
  rightWidth: 380,
  leftVisible: true,
  rightVisible: true,
  diffMode: 'hunk',
  wrap: false,
  autoFetchMinutes: 10,
  fileView: 'list',
  graphFilters: {}
}

let cache: Settings | null = null

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): Settings {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf8')) }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache!
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch }
  mkdirSync(dirname(file()), { recursive: true })
  writeFileSync(file(), JSON.stringify(cache, null, 2))
  return cache
}

export function addRecent(repo: string): void {
  updateSettings({ recent: pushRecent(getSettings().recent, repo) })
}

export function removeRecent(paths: string[]): string[] {
  return updateSettings({ recent: withoutRecent(getSettings().recent, paths) }).recent
}

/** La lista de recientes con una marca para los repos que ya no están en disco. */
export function getRecentRepos(): RecentRepo[] {
  return getSettings().recent.map((path) => ({ path, exists: existsSync(join(path, '.git')) }))
}
