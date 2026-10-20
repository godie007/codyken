import { watch, type FSWatcher } from 'node:fs'
import { relative, sep } from 'node:path'
import type { RepoChangedEvent } from '../shared/types'

interface Entry {
  watchers: FSWatcher[]
  timer: NodeJS.Timeout | null
  refs: boolean
}

const IGNORED_GIT_PATHS = /^(objects|logs|lfs|hooks)([\\/]|$)|\.lock$/

/** Vigila el árbol de trabajo y el directorio .git; agrupa los eventos en ráfagas. */
export class RepoWatchers {
  private entries = new Map<string, Entry>()

  constructor(private notify: (event: RepoChangedEvent) => void) {}

  watch(repo: string, gitDir: string): void {
    if (this.entries.has(repo)) return
    const entry: Entry = { watchers: [], timer: null, refs: false }
    const gitInsideRepo = !relative(repo, gitDir).startsWith('..')

    const schedule = (refs: boolean): void => {
      entry.refs ||= refs
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        entry.timer = null
        const changedRefs = entry.refs
        entry.refs = false
        this.notify({ repo, refs: changedRefs })
      }, 350)
    }

    const onGitPath = (gitPath: string): void => {
      if (IGNORED_GIT_PATHS.test(gitPath)) return
      schedule(gitPath !== 'index')
    }

    try {
      entry.watchers.push(
        watch(repo, { recursive: true }, (_event, filename) => {
          if (!filename) return schedule(true)
          const name = filename.toString()
          const gitPrefix = gitInsideRepo ? relative(repo, gitDir) + sep : null
          if (gitPrefix && (name + sep).startsWith(gitPrefix)) onGitPath(name.slice(gitPrefix.length))
          else if (!name.split(/[\\/]/).includes('node_modules')) schedule(false)
        })
      )
      if (!gitInsideRepo) {
        entry.watchers.push(
          watch(gitDir, { recursive: true }, (_event, filename) => onGitPath(filename ? filename.toString() : 'HEAD'))
        )
      }
    } catch {
      // Sin vigilancia la app sigue funcionando; solo pierde el refresco automático
    }
    this.entries.set(repo, entry)
  }

  unwatch(repo: string): void {
    const entry = this.entries.get(repo)
    if (!entry) return
    if (entry.timer) clearTimeout(entry.timer)
    entry.watchers.forEach((w) => w.close())
    this.entries.delete(repo)
  }

  closeAll(): void {
    for (const repo of [...this.entries.keys()]) this.unwatch(repo)
  }
}
