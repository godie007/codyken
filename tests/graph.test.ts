import { describe, expect, it } from 'vitest'
import { computeGraph, WIP_HASH } from '../src/renderer/src/lib/graph'

describe('computeGraph', () => {
  it('historial lineal usa un solo carril', () => {
    const { rows, maxLanes } = computeGraph([
      { hash: 'c', parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] }
    ])
    expect(maxLanes).toBe(1)
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(rows[2].segments.filter((s) => s.y1 === 0.5)).toHaveLength(0)
  })

  it('una rama y su merge abren y cierran un segundo carril', () => {
    // m = merge(c, f); f sale de b; c sale de b
    const { rows, maxLanes } = computeGraph([
      { hash: 'm', parents: ['c', 'f'] },
      { hash: 'f', parents: ['b'] },
      { hash: 'c', parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] }
    ])
    expect(maxLanes).toBe(2)
    expect(rows[0].lane).toBe(0)
    expect(rows[1].lane).toBe(1)
    expect(rows[2].lane).toBe(0)
    expect(rows[3].lane).toBe(0)
    // b recibe trazos desde los dos carriles
    const incoming = rows[3].segments.filter((s) => s.y1 === 0)
    expect(incoming.map((s) => s.x1).sort()).toEqual([0, 1])
    // en la fila de c, el carril 1 (f→b) ya no sigue de largo: f está arriba
    expect(rows[2].segments.some((s) => s.x1 === 1 && s.x2 === 1 && s.y1 === 0 && s.y2 === 1)).toBe(true)
  })

  it('el nodo WIP dibuja trazos punteados hasta HEAD aunque HEAD no sea la primera fila', () => {
    const { rows } = computeGraph([
      { hash: WIP_HASH, parents: ['b'] },
      { hash: 'x', parents: ['b'] },
      { hash: 'b', parents: [] }
    ])
    expect(rows[0].segments.every((s) => s.dashed)).toBe(true)
    const passThrough = rows[1].segments.find((s) => s.x1 === 0 && s.x2 === 0 && s.y1 === 0 && s.y2 === 1)
    expect(passThrough?.dashed).toBe(true)
    const intoHead = rows[2].segments.filter((s) => s.y1 === 0)
    expect(intoHead.some((s) => s.dashed)).toBe(true)
    expect(intoHead.some((s) => !s.dashed)).toBe(true)
  })

  it('la rama actual va en el carril 0 aunque haya commits más nuevos en otras ramas', () => {
    // d1, d2: merges en deploy (más nuevos) que integran h y b de la rama actual
    const { rows } = computeGraph(
      [
        { hash: 'd1', parents: ['d0', 'h'] },
        { hash: 'h', parents: ['b'] },
        { hash: 'd0', parents: ['a', 'b'] },
        { hash: 'b', parents: ['a'] },
        { hash: 'a', parents: [] }
      ],
      'h'
    )
    expect(rows.map((r) => r.lane)).toEqual([1, 0, 1, 0, 0])
    // Sobre la primera fila no se dibuja el carril reservado
    expect(rows[0].segments.some((s) => s.x1 === 0 && s.y1 === 0)).toBe(false)
  })

  it('sin primary visible no reserva carril', () => {
    const { rows } = computeGraph([{ hash: 'a', parents: [] }], 'zzz')
    expect(rows[0].lane).toBe(0)
  })
})
