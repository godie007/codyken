import { useCallback, useEffect, useRef, useState } from 'react'
import type { Commit, GraphFilter, Ref, Remote, RepoState, StashEntry, WorkingStatus } from '../../shared/types'
import { api, bridge } from './api'

const PAGE = 2000

export interface RepoData {
  commits: Commit[]
  refs: Ref[]
  remotes: Remote[]
  state: RepoState | null
  status: WorkingStatus
  stashes: StashEntry[]
  submodules: string[]
  loaded: boolean
  error: string | null
  limit: number
  /** Sube cada vez que cambia el árbol de trabajo; sirve para refrescar diffs abiertos */
  statusVersion: number
}

const EMPTY_STATUS: WorkingStatus = { staged: [], unstaged: [], conflicted: [] }

const NO_FILTER: GraphFilter = { hidden: [], solo: [] }

export function useRepoData(repo: string, filter: GraphFilter = NO_FILTER) {
  const [data, setData] = useState<RepoData>({
    commits: [],
    refs: [],
    remotes: [],
    state: null,
    status: EMPTY_STATUS,
    stashes: [],
    submodules: [],
    loaded: false,
    error: null,
    limit: PAGE,
    statusVersion: 0
  })
  const limit = useRef(PAGE)
  const filterRef = useRef(filter)
  filterRef.current = filter
  const filterKey = JSON.stringify(filter)
  const allSeq = useRef(0)
  const statusSeq = useRef(0)

  const refreshAll = useCallback(async () => {
    const id = ++allSeq.current
    statusSeq.current++
    try {
      const [refs, state, status, stashes, commits, submodules, remotes] = await Promise.all([
        api.getRefs(repo),
        api.getRepoState(repo),
        api.getStatus(repo),
        api.getStashes(repo),
        api.getLog(repo, limit.current, filterRef.current),
        api.getSubmodules(repo),
        api.getRemotes(repo)
      ])
      if (id !== allSeq.current) return
      setData((d) => ({ ...d, refs, remotes, state, status, stashes, commits, submodules, loaded: true, error: null, limit: limit.current, statusVersion: d.statusVersion + 1 }))
    } catch (error) {
      if (id !== allSeq.current) return
      setData((d) => ({ ...d, loaded: true, error: error instanceof Error ? error.message : String(error) }))
    }
  }, [repo])

  const refreshStatus = useCallback(async () => {
    const id = ++statusSeq.current
    try {
      const [status, state] = await Promise.all([api.getStatus(repo), api.getRepoState(repo)])
      if (id !== statusSeq.current) return
      setData((d) => ({ ...d, status, state, statusVersion: d.statusVersion + 1 }))
    } catch {
      // El siguiente refresco completo mostrará el error
    }
  }, [repo])

  const firstFilter = useRef(true)
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false
      return
    }
    void refreshAll()
  }, [filterKey, refreshAll])

  const loadMore = useCallback(() => {
    limit.current += PAGE
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    void refreshAll()
    void api.watchRepo(repo).catch(() => {})
    const off = bridge.onRepoChanged((event) => {
      if (event.repo !== repo) return
      if (event.refs) void refreshAll()
      else void refreshStatus()
    })
    const onFocus = (): void => void refreshAll()
    window.addEventListener('focus', onFocus)
    return () => {
      off()
      window.removeEventListener('focus', onFocus)
      void api.unwatchRepo(repo).catch(() => {})
    }
  }, [repo, refreshAll, refreshStatus])

  return { data, refreshAll, refreshStatus, loadMore }
}
