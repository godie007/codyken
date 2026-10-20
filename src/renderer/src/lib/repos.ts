import { homeRelative, repoName } from './format'
import { fuzzyScore } from './fuzzy'

/** Filtra la lista de recientes por nombre o ruta. Sin búsqueda conserva el orden (el más reciente primero). */
export function matchRepos(paths: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return paths
  const scored: { path: string; score: number }[] = []
  for (const path of paths) {
    const byName = fuzzyScore(q, repoName(path))
    const byPath = fuzzyScore(q, homeRelative(path))
    const score = Math.max(byName === null ? -Infinity : byName + 50, byPath ?? -Infinity)
    if (score > -Infinity) scored.push({ path, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.path)
}
