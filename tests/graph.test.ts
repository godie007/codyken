import { describe, expect, it } from 'vitest'
import { computeGraph, WIP_HASH, withStashes } from '../src/renderer/src/lib/graph'

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

describe('cabecera del gráfico', () => {
  it('HEAD arriba del todo no tiene una línea que suba', () => {
    const { rows } = computeGraph([
      { hash: 'c', parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] }
    ], 'c')
    expect(rows[0].segments.filter((s) => s.y1 === 0)).toHaveLength(0)
  })

  it('tampoco el WIP, y su trazo punteado sí baja hasta HEAD', () => {
    const { rows } = computeGraph([
      { hash: WIP_HASH, parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] }
    ], WIP_HASH)
    expect(rows[0].segments.filter((s) => s.y1 === 0)).toHaveLength(0)
    expect(rows[1].segments.some((s) => s.y1 === 0 && s.dashed)).toBe(true)
  })

  it('HEAD más abajo, con ramas más nuevas encima: no hay tramo fantasma sobre HEAD', () => {
    // f es una rama más nueva que sale de a; HEAD es b
    const { rows } = computeGraph([
      { hash: 'f', parents: ['a'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] }
    ], 'b')
    expect(rows[1].lane).toBe(0)
    expect(rows[1].segments.filter((s) => s.y1 === 0 && s.x2 === 0)).toHaveLength(0)
  })
})

describe('withStashes', () => {
  const commit = (hash: string, date: number, parents: string[]) => ({ hash, parents, author: 'Ana', email: 'a@x.co', date, subject: hash })
  const stash = (index: number, base: string, date: number) => ({ index, hash: `s${index}`, base, author: 'Ana', email: 'a@x.co', date, message: `stash ${index}` })

  it('pone cada stash justo encima de su commit aunque sea mucho más reciente', () => {
    const commits = [commit('d', 40, ['c']), commit('c', 30, ['b']), commit('b', 20, ['a']), commit('a', 10, [])]
    const out = withStashes(commits, [stash(0, 'b', 100), stash(1, 'b', 50), stash(2, 'nadie', 60)])
    expect(out.map((c) => c.hash)).toEqual(['d', 'c', 's0', 's1', 'b', 'a'])
    expect(out[2]).toMatchObject({ parents: ['b'], stash: 0 })
  })

  it('el stash cuelga de su base en un carril corto', () => {
    const commits = [commit('c', 30, ['b']), commit('b', 20, ['a']), commit('a', 10, [])]
    const out = withStashes(commits, [stash(0, 'b', 100)])
    const { rows } = computeGraph(out, 'c')
    expect(rows[1].lane).toBe(1)
    expect(rows[2].segments.some((s) => s.x1 === 1 && s.x2 === 0 && s.dashed)).toBe(true)
  })
})
