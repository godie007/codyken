import { describe, expect, it } from 'vitest'
import { diffLines, lineMarks } from '../src/renderer/src/lib/linediff'

/** Reconstruye `b` desde `a` con las operaciones, para comprobar que el diff es válido */
const apply = (a: string[], b: string[], ops: string[]): string[] => {
  const out: string[] = []
  let i = 0
  let j = 0
  for (const op of ops) {
    if (op === '=') {
      expect(a[i]).toBe(b[j])
      out.push(a[i++])
      j++
    } else if (op === '-') i++
    else out.push(b[j++])
  }
  expect(i).toBe(a.length)
  return out
}

describe('diffLines', () => {
  it('da el diff más corto', () => {
    const a = ['a', 'b', 'c', 'a', 'b', 'b', 'a']
    const b = ['c', 'b', 'a', 'b', 'a', 'c']
    const ops = diffLines(a, b)
    expect(apply(a, b, ops)).toEqual(b)
    // El clásico ejemplo de Myers: 5 ediciones
    expect(ops.filter((o) => o !== '=').length).toBe(5)
  })

  it('funciona con textos vacíos y con iguales', () => {
    expect(diffLines([], ['x'])).toEqual(['+'])
    expect(diffLines(['x'], [])).toEqual(['-'])
    expect(diffLines(['x', 'y'], ['x', 'y'])).toEqual(['=', '='])
  })

  it('es correcto con cambios aleatorios', () => {
    let seed = 7
    const rand = (n: number): number => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n)
    for (let round = 0; round < 200; round++) {
      const a = Array.from({ length: rand(30) }, () => String(rand(5)))
      const b = Array.from({ length: rand(30) }, () => String(rand(5)))
      expect(apply(a, b, diffLines(a, b))).toEqual(b)
    }
  })

  it('con demasiadas diferencias marca todo el tramo del medio', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`)
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`)
    const ops = diffLines(['x', ...a, 'y'], ['x', ...b, 'y'])
    expect(ops.length).toBe(6002)
    expect(ops[0]).toBe('=')
    expect(ops.at(-1)).toBe('=')
  })
})

describe('lineMarks', () => {
  it('distingue líneas cambiadas, añadidas y borradas', () => {
    const base = 'uno\ndos\ntres\ncuatro\ncinco\n'
    const text = 'uno\nDOS\nnueva\ntres\ncinco\n'
    const { marks, deletedBefore, added, removed } = lineMarks(base, text)
    expect(marks.slice(0, 5)).toEqual([null, 'mod', 'add', null, null])
    // "cuatro" se borró justo antes de "cinco" (línea 4, índice desde 0)
    expect([...deletedBefore]).toEqual([4])
    expect({ added, removed }).toEqual({ added: 2, removed: 2 })
  })

  it('marca un borrado al final del archivo', () => {
    expect([...lineMarks('a\nb\n', 'a\n').deletedBefore]).toEqual([1])
  })
})
