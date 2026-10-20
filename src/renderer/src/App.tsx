import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings } from '../../shared/types'
import { api, isMac } from './api'
import { Icon, Logo } from './components/Icons'
import { RepoView } from './components/RepoView'
import { PromptProvider, ToastProvider, useToast } from './components/ui'
import { Welcome } from './components/Welcome'
import { homeRelative, repoName } from './lib/format'

interface Tab {
  id: string
  path: string | null
}

let tabSeq = 0
const newTab = (path: string | null = null): Tab => ({ id: `tab-${++tabSeq}`, path })

export function App() {
  return (
    <ToastProvider>
      <PromptProvider>
        <Shell />
      </PromptProvider>
    </ToastProvider>
  )
}

function Shell() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState(0)
  const pending = useRef<Partial<Settings>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    pending.current = { ...pending.current, ...patch }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const toSave = pending.current
      pending.current = {}
      void api.updateSettings(toSave)
    }, 300)
  }, [])

  useEffect(() => {
    void (async () => {
      const loaded = await api.getSettings()
      const valid: string[] = []
      for (const path of loaded.tabs) {
        if (!path) continue
        try {
          // Restaurar pestañas no reordena ni devuelve a la lista los repos que el usuario quitó
          valid.push(await api.resolveRepo(path, false))
        } catch {
          // El repo se movió o se borró: se omite la pestaña
        }
      }
      const initial = valid.length ? valid.map((p) => newTab(p)) : [newTab()]
      setSettings(loaded)
      setTabs(initial)
      setActive(Math.min(Math.max(loaded.activeTab, 0), initial.length - 1))
    })()
  }, [])

  useEffect(() => {
    if (!settings || !tabs.length) return
    updateSettings({ tabs: tabs.map((t) => t.path), activeTab: active })
  }, [tabs, active])

  const refreshRecent = (): void => {
    void api.getSettings().then((s) => setSettings((cur) => (cur ? { ...cur, recent: s.recent } : cur)))
  }

  const removeRecent = async (paths: string[]): Promise<void> => {
    try {
      const recent = await api.removeRecent(paths)
      setSettings((cur) => (cur ? { ...cur, recent } : cur))
    } catch (e) {
      toast('error', 'No se pudo actualizar la lista', e instanceof Error ? e.message : String(e))
    }
  }

  const openRepo = async (path?: string): Promise<void> => {
    const target = path ?? (await api.pickDirectory('Abrir repositorio'))
    if (!target) return
    let root: string
    try {
      root = await api.resolveRepo(target)
    } catch (e) {
      toast('error', 'No se pudo abrir', e instanceof Error ? e.message : String(e))
      return
    }
    refreshRecent()
    const existing = tabs.findIndex((t) => t.path === root)
    if (existing !== -1) return setActive(existing)
    if (tabs[active]?.path === null) {
      setTabs((list) => list.map((t, i) => (i === active ? { ...t, path: root } : t)))
    } else {
      setTabs((list) => [...list, newTab(root)])
      setActive(tabs.length)
    }
  }

  const addTab = (): void => {
    const blank = tabs.findIndex((t) => t.path === null)
    if (blank !== -1) return setActive(blank)
    setTabs((list) => [...list, newTab()])
    setActive(tabs.length)
  }

  const closeTab = (index: number): void => {
    if (tabs.length === 1) {
      setTabs([newTab()])
      setActive(0)
      return
    }
    setTabs((list) => list.filter((_, i) => i !== index))
    setActive((a) => (a > index || a === tabs.length - 1 ? Math.max(0, a - 1) : a))
  }

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    const cmd = e.metaKey || e.ctrlKey
    if (!cmd) return
    const key = e.key.toLowerCase()
    if (key === 't' && !e.shiftKey) return e.preventDefault(), addTab()
    if (key === 'w' && !e.shiftKey) return e.preventDefault(), closeTab(active)
    if (key === 'o' && !e.shiftKey) return e.preventDefault(), void openRepo()
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const index = Number(e.key) - 1
      if (index < tabs.length) setActive(index)
      return
    }
    if (e.key === 'Tab' && e.ctrlKey) {
      e.preventDefault()
      setActive((a) => (a + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length)
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent): void => keyHandler.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  if (!settings || !tabs.length) return <div className="app-loading"><Logo size={40} /></div>
  const current = tabs[active]
  const openRepos = tabs.flatMap((t) => (t.path ? [t.path] : []))

  return (
    <div className="app">
      <div className={`tabbar ${isMac ? 'mac' : ''}`}>
        <div className="tabbar-brand"><Logo size={16} /></div>
        <div className="tabs">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              className={`tab ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              onAuxClick={(e) => e.button === 1 && closeTab(i)}
              title={tab.path ? homeRelative(tab.path) : 'Nueva pestaña'}
            >
              <span className="truncate">{tab.path ? repoName(tab.path) : 'Nueva pestaña'}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(i)
                }}
                aria-label="Cerrar pestaña"
              >
                <Icon.Close size={11} />
              </button>
            </div>
          ))}
          <button className="tab-add" onClick={addTab} title="Nueva pestaña">
            <Icon.Plus size={14} />
          </button>
        </div>
      </div>
      <div className="app-body">
        {current.path ? (
          <RepoView
            key={current.id + current.path}
            repo={current.path}
            settings={settings}
            onSettings={updateSettings}
            onOpenRepo={(p) => void openRepo(p)}
            onNewTab={addTab}
            openRepos={openRepos}
            onRemoveRecent={(paths) => void removeRecent(paths)}
          />
        ) : (
          <Welcome
            recent={settings.recent}
            openRepos={openRepos}
            onOpen={(p) => void openRepo(p)}
            onRemoveRecent={(paths) => void removeRecent(paths)}
          />
        )}
      </div>
    </div>
  )
}
