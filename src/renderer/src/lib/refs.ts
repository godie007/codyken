import type { Ref } from '../../../shared/types'

export interface RefLabel {
  key: string
  kind: 'branch' | 'tag' | 'head'
  name: string
  local?: Ref
  remotes: Ref[]
  tag?: Ref
  isHead: boolean
  /** Rama local de esta remota cuando está en otro commit: va por delante o por detrás */
  localTwin?: Ref
}

/**
 * Agrupa las referencias por commit. Una rama en el mismo commit en local y en sus remotos es una sola
 * etiqueta: se le unen la remota que sigue (upstream) y las que se llaman igual, de cualquier remoto.
 */
export function labelsByCommit(refs: Ref[], detachedHead: string | null): Map<string, RefLabel[]> {
  const map = new Map<string, RefLabel[]>()
  const list = (hash: string): RefLabel[] => {
    let labels = map.get(hash)
    if (!labels) {
      labels = []
      map.set(hash, labels)
    }
    return labels
  }

  if (detachedHead) list(detachedHead).push({ key: 'HEAD', kind: 'head', name: 'HEAD', remotes: [], isHead: true })

  for (const ref of refs) {
    if (ref.type === 'local') {
      list(ref.hash).push({ key: ref.fullName, kind: 'branch', name: ref.name, local: ref, remotes: [], isHead: !!ref.isHead })
    }
  }
  const locals = refs.filter((r) => r.type === 'local')
  for (const ref of refs) {
    if (ref.type !== 'remote') continue
    const short = shortName(ref)
    const labels = list(ref.hash)
    const twin =
      labels.find((l) => l.kind === 'branch' && l.local?.upstream === ref.name) ??
      labels.find((l) => l.kind === 'branch' && l.local?.name === short) ??
      labels.find((l) => l.kind === 'branch' && !l.local && shortName(l.remotes[0]) === short)
    if (twin) twin.remotes.push(ref)
    else {
      const localTwin = locals.find((l) => l.upstream === ref.name) ?? locals.find((l) => !l.upstream && l.name === short)
      labels.push({ key: ref.fullName, kind: 'branch', name: ref.name, remotes: [ref], isHead: false, localTwin })
    }
  }
  for (const ref of refs) {
    if (ref.type === 'tag') list(ref.hash).push({ key: ref.fullName, kind: 'tag', name: ref.name, tag: ref, remotes: [], isHead: false })
  }

  for (const labels of map.values()) {
    const rank = (l: RefLabel): number => (l.isHead ? 0 : l.kind === 'branch' && l.local ? 1 : l.kind === 'branch' ? 2 : 3)
    labels.sort((a, b) => rank(a) - rank(b))
  }
  return map
}

const shortName = (ref: Ref): string => ref.name.slice(ref.name.indexOf('/') + 1)

/** Texto de la etiqueta: el nombre de la rama; de qué remoto es lo dice su insignia */
export function labelText(label: RefLabel): string {
  return !label.local && label.remotes.length ? shortName(label.remotes[0]) : label.name
}

/** Commits de diferencia entre la rama local y la remota que sigue; la misma cifra en sus dos etiquetas */
export function labelTrack(label: RefLabel): { ahead: number; behind: number } {
  const local = label.local ?? label.localTwin
  return { ahead: local?.ahead ?? 0, behind: local?.behind ?? 0 }
}

/** Referencia completa de una etiqueta de rama (la local si la hay); es lo que se arrastra. */
export function labelFullName(label: RefLabel): string | null {
  return (label.local ?? label.remotes[0])?.fullName ?? null
}

/** Nombre de la rama dentro de su remoto: `origin/feature/x` → `feature/x` */
export function remoteBranchName(ref: Ref): string {
  return ref.remote ? ref.name.slice(ref.remote.length + 1) : ref.name
}

/** Rama remota que corresponde a una local: la que sigue o, si no sigue ninguna, la que se llama igual en `remote`. */
export function remoteTwin(local: Ref, refs: Ref[], remote?: string | null): Ref | undefined {
  if (local.upstream) return refs.find((r) => r.type === 'remote' && r.name === local.upstream)
  return refs.find((r) => r.type === 'remote' && (!remote || r.remote === remote) && remoteBranchName(r) === local.name)
}

export interface TreeNode<T> {
  name: string
  path: string
  children: TreeNode<T>[]
  item?: T
}

/** Convierte `feature/login`, `feature/pago` en una carpeta `feature` con dos hojas. */
export function buildTree<T>(items: T[], pathOf: (item: T) => string): TreeNode<T>[] {
  const root: TreeNode<T> = { name: '', path: '', children: [] }
  for (const item of items) {
    const parts = pathOf(item).split('/')
    let node = root
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      let child = isLeaf ? undefined : node.children.find((c) => c.name === part && !c.item)
      if (!child) {
        child = { name: part, path, children: [], item: isLeaf ? item : undefined }
        node.children.push(child)
      }
      node = child
    })
  }
  const sort = (nodes: TreeNode<T>[]): TreeNode<T>[] => {
    nodes.sort((a, b) => Number(!!a.item) - Number(!!b.item) || a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
    return nodes
  }
  return sort(root.children)
}
