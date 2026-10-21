import { describe, expect, it } from 'vitest'
import { detectEol, detectIndent, indentEdit, lineColumn, newlineEdit, offsetOfLine, type TextEdit } from '../src/renderer/src/lib/editing'

const run = (value: string, edit: TextEdit | null): string => (edit ? value.slice(0, edit.from) + edit.text + value.slice(edit.to) : value)

describe('detección del formato', () => {
  it('detecta tabuladores, 2 y 4 espacios', () => {
    expect(detectIndent('a\n\tb\n\t\tc\n')).toBe('\t')
    expect(detectIndent('a {\n  b {\n    c\n  }\n}\n')).toBe('  ')
    expect(detectIndent('def f():\n    if x:\n        y\n    z\n')).toBe('    ')
    expect(detectIndent('sin sangría\n')).toBe('  ')
  })

  it('detecta CRLF por mayoría', () => {
    expect(detectEol('a\r\nb\r\nc\n')).toBe('\r\n')
    expect(detectEol('a\nb\n')).toBe('\n')
  })
})

describe('tabulador', () => {
  it('inserta la sangría en el cursor', () => {
    const edit = indentEdit('ab', 1, 1, '  ', false)
    expect(run('ab', edit)).toBe('a  b')
    expect(edit?.selectionStart).toBe(3)
  })

  it('sangra y quita sangría a las líneas seleccionadas y las deja seleccionadas', () => {
    const value = 'uno\ndos\ntres\n'
    // Selección de "no\ndo": líneas 1 y 2
    const edit = indentEdit(value, 1, 6, '\t', false)!
    expect(run(value, edit)).toBe('\tuno\n\tdos\ntres\n')
    const indented = run(value, edit)
    expect(indented.slice(edit.selectionStart, edit.selectionEnd)).toBe('\tuno\n\tdos')
    const back = indentEdit(indented, edit.selectionStart, edit.selectionEnd, '\t', true)
    expect(run(indented, back)).toBe(value)
  })

  it('una selección que acaba al principio de una línea no la incluye', () => {
    expect(run('a\nb\nc', indentEdit('a\nb\nc', 0, 4, '  ', false))).toBe('  a\n  b\nc')
  })

  it('Mayús+Tab en una línea quita una unidad y mueve el cursor', () => {
    const value = 'x\n      y'
    const edit = indentEdit(value, 8, 8, '  ', true)!
    expect(run(value, edit)).toBe('x\n    y')
    expect(edit.selectionStart).toBe(6)
    expect(indentEdit('sin', 1, 1, '  ', true)).toBeNull()
  })
})

describe('Enter con sangría', () => {
  it('mantiene la sangría de la línea', () => {
    const value = 'a\n    b'
    expect(run(value, newlineEdit(value, 7, 7))).toBe('a\n    b\n    ')
    expect(newlineEdit('a', 1, 1)).toBeNull()
  })
})

describe('líneas y columnas', () => {
  it('convierte posiciones', () => {
    const value = 'uno\ndos\ntres'
    expect(lineColumn(value, 0)).toEqual({ line: 1, column: 1 })
    expect(lineColumn(value, 5)).toEqual({ line: 2, column: 2 })
    expect(lineColumn(value, value.length)).toEqual({ line: 3, column: 5 })
    expect(offsetOfLine(value, 3)).toBe(8)
    expect(offsetOfLine(value, 99)).toBe(value.length)
  })
})
