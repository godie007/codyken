import type { Ref } from '../../../shared/types'

export interface RefLabel {
  key: string
  kind: 'branch' | 'tag' | 'head'
  name: string
  local?: Ref
  remotes: Ref[]
  tag?: Ref
  isHead: boolean
}

/**
 * Agrupa las referencias por commit. Si una rama local y su remota están en el mismo commit se muestran
 * como una sola etiqueta: la remota que sigue (upstream) o, si no sigue ninguna, la que se llama igual.
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
  for (const ref of refs) {
    if (ref.type !== 'remote') continue
    const short = ref.name.slice(ref.name.indexOf('/') + 1)
    const labels = list(ref.hash)
    const twin =
      labels.find((l) => l.kind === 'branch' && l.local?.upstream === ref.name) ??
      labels.find((l) => l.kind === 'branch' && l.local && !l.local.upstream && l.name === short)
    if (twin) twin.remotes.push(ref)
    else labels.push({ key: ref.fullName, kind: 'branch', name: ref.name, remotes: [ref], isHead: false })
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
