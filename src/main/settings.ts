import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Settings } from '../shared/types'

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
  const recent = [repo, ...getSettings().recent.filter((r) => r !== repo)].slice(0, 15)
  updateSettings({ recent })
}
