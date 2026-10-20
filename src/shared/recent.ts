/** Cuántos repositorios recuerda la lista de recientes. */
export const MAX_RECENT = 50

/** Pone el repo al principio de la lista (sin duplicados) y recorta al máximo. */
export function pushRecent(list: string[], repo: string, max = MAX_RECENT): string[] {
  return [repo, ...list.filter((r) => r !== repo)].slice(0, max)
}

/** Quita de la lista las rutas indicadas conservando el orden del resto. */
export function withoutRecent(list: string[], paths: string[]): string[] {
  const drop = new Set(paths)
  return list.filter((r) => !drop.has(r))
}
