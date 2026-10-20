export const WIP_HASH = '__wip__'

export interface GraphNode {
  hash: string
  parents: string[]
  /** Stash: se dibuja con trazo punteado hasta su commit base */
  stash?: number
}

export interface Segment {
  /** Carril de origen y destino; y va de 0 (arriba de la fila) a 1 (abajo) */
  x1: number
  y1: number
  x2: number
  y2: number
  color: number
  dashed: boolean
}

export interface GraphRow {
  lane: number
  color: number
  segments: Segment[]
}

export interface GraphLayout {
  rows: GraphRow[]
  maxLanes: number
}

/**
 * Asigna un carril a cada commit (en orden topológico, el más nuevo primero) y
 * calcula los trazos que lo unen con sus padres. Cada carril guarda el hash
 * del commit que espera encontrar más abajo.
 */
export function computeGraph(nodes: GraphNode[], primary?: string | null): GraphLayout {
  const lanes: (string | null)[] = []
  const laneColors: number[] = []
  const dashedLanes = new Set<number>()
  const rows: GraphRow[] = []
  let nextColor = 0
  let maxLanes = 1
  // El carril 0 queda reservado para `primary` (WIP o HEAD) y su primer padre, como columna principal.
  // Mientras nada de arriba lo use es un carril fantasma: ocupa el sitio pero no se dibuja.
  let phantom: string | null = null
  if (primary && nodes.some((n) => n.hash === primary)) {
    lanes[0] = primary
    laneColors[0] = nextColor++
    phantom = primary
  }

  const freeSlot = (): number => {
    const index = lanes.indexOf(null)
    return index === -1 ? lanes.length : index
  }

  for (const node of nodes) {
    const before = lanes.slice()
    const beforeColors = laneColors.slice()
    const beforeDashed = new Set(dashedLanes)

    const rowPhantom = phantom
    if (node.hash === phantom) phantom = null
    let lane = lanes.indexOf(node.hash)
    if (lane === -1) {
      lane = freeSlot()
      lanes[lane] = node.hash
      laneColors[lane] = nextColor++
    }
    const color = laneColors[lane]
    const isWip = node.hash === WIP_HASH || node.stash !== undefined
    const segments: Segment[] = []

    before.forEach((hash, i) => {
      if (hash !== node.hash) return
      segments.push({ x1: i, y1: 0, x2: lane, y2: 0.5, color: beforeColors[i], dashed: beforeDashed.has(i) })
      dashedLanes.delete(i)
    })
    for (let i = 0; i < lanes.length; i++) {
      if (i !== lane && lanes[i] === node.hash) lanes[i] = null
    }

    const [first, ...rest] = node.parents
    if (first === undefined) {
      lanes[lane] = null
    } else {
      lanes[lane] = first
      if (isWip) dashedLanes.add(lane)
      segments.push({ x1: lane, y1: 0.5, x2: lane, y2: 1, color, dashed: isWip })
      for (const parent of rest) {
        let target = lanes.indexOf(parent)
        if (target === 0 && parent === phantom) phantom = null
        if (target === -1) {
          target = freeSlot()
          lanes[target] = parent
          laneColors[target] = nextColor++
        }
        segments.push({ x1: lane, y1: 0.5, x2: target, y2: 1, color: laneColors[target], dashed: false })
      }
    }

    before.forEach((hash, i) => {
      if (hash !== null && hash !== node.hash && lanes[i] === hash && !(i === 0 && hash === rowPhantom)) {
        segments.push({ x1: i, y1: 0, x2: i, y2: 1, color: beforeColors[i], dashed: beforeDashed.has(i) })
      }
    })

    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()
    maxLanes = Math.max(maxLanes, before.length, lanes.length, lane + 1)
    rows.push({ lane, color, segments })
  }

  return { rows, maxLanes }
}

// Paleta Monokai: cian, verde, rosa, naranja, violeta, amarillo y variantes
export const LANE_COLORS = [
  '#66d9ef', '#a6e22e', '#f92672', '#fd971f', '#ae81ff',
  '#e6db74', '#78dce8', '#ff6188', '#a9dc76', '#fc9867'
]

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length]
}
