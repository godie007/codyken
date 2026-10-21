import { describe, expect, it } from 'vitest'
import { hasMarkers, joinResult, parseConflicts, resultLines, toggleSide, wholeFileConflict, type Choice } from '../src/renderer/src/lib/conflict'
import { rebaseProblem } from '../src/renderer/src/lib/rebase'

const FILE = ['uno', '<<<<<<< HEAD', 'dos de main', '=======', 'dos del lado', 'dos y medio', '>>>>>>> feature/x', 'tres', ''].join('\n')

describe('editor de conflictos', () => {
  it('separa tramos comunes y conflictos con sus etiquetas', () => {
    const parsed = parseConflicts(FILE)!
    expect(parsed.conflicts).toBe(1)
    expect(parsed.trailingNewline).toBe(true)
    expect(parsed.segments).toEqual([
      { kind: 'common', lines: ['uno'] },
      { kind: 'conflict', index: 0, ours: ['dos de main'], base: null, theirs: ['dos del lado', 'dos y medio'], oursLabel: 'HEAD', theirsLabel: 'feature/x' },
      { kind: 'common', lines: ['tres'] }
    ])
  })

  it('entiende el estilo diff3 con la versión base', () => {
    const parsed = parseConflicts('<<<<<<< ours\na\n||||||| base\nb\n=======\nc\n>>>>>>> theirs\n')!
    expect(parsed.segments[0]).toMatchObject({ ours: ['a'], base: ['b'], theirs: ['c'] })
  })

  it('arma el resultado según las casillas, en el orden en que se marcaron', () => {
    const parsed = parseConflicts(FILE)!
    const result = (choice: Choice): string => joinResult(parsed, resultLines(parsed, [choice]).map((l) => l.text))
    expect(result(['ours'])).toBe('uno\ndos de main\ntres\n')
    expect(result(['theirs', 'ours'])).toBe('uno\ndos del lado\ndos y medio\ndos de main\ntres\n')
    expect(result([])).toBe('uno\ntres\n')
    expect(hasMarkers(result(null))).toBe(true)
    expect(toggleSide(toggleSide(null, 'theirs'), 'ours')).toEqual(['theirs', 'ours'])
    expect(toggleSide(['ours'], 'ours')).toBeNull()
  })

  it('conserva los finales de línea de Windows', () => {
    const parsed = parseConflicts('a\r\n<<<<<<< HEAD\r\nb\r\n=======\r\nc\r\n>>>>>>> x\r\n')!
    expect(joinResult(parsed, resultLines(parsed, [['theirs']]).map((l) => l.text))).toBe('a\r\nc\r\n')
  })

  it('rechaza marcadores incompletos o anidados', () => {
    expect(parseConflicts('<<<<<<< HEAD\na\n=======\nb\n')).toBeNull()
    expect(parseConflicts('<<<<<<< HEAD\n<<<<<<< otro\n')).toBeNull()
    expect(parseConflicts('texto con ======= en medio\n')!.conflicts).toBe(0)
  })

  it('sin marcadores ofrece las dos versiones completas', () => {
    const parsed = wholeFileConflict('mío\n', null, 'base\n')
    expect(parsed.segments[0]).toMatchObject({ ours: ['mío'], theirs: [], base: ['base'] })
  })
})

describe('validación del rebase interactivo', () => {
  it('avisa si el primer commit se combina o falta un mensaje', () => {
    expect(rebaseProblem([{ action: 'drop', draft: '' }, { action: 'fixup', draft: '' }])).toContain('primer commit')
    expect(rebaseProblem([{ action: 'reword', draft: '  ' }])).toContain('mensaje')
    expect(rebaseProblem([{ action: 'pick', draft: '' }, { action: 'squash', draft: '' }])).toBeNull()
  })
})
