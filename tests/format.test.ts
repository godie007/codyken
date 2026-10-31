import { describe, expect, it } from 'vitest'
import { splitMiddle } from '../src/renderer/src/lib/format'

describe('splitMiddle', () => {
  it('deja entero un nombre corto', () => {
    expect(splitMiddle('README.md')).toEqual({ head: 'README.md', tail: '' })
  })

  it('reserva el final con la extensión y no pierde caracteres', () => {
    const name = 'BUG-065-subida-de-fotos-lenta-el-servidor-recomprimia-cada-foto.md'
    const { head, tail } = splitMiddle(name)
    expect(tail).toBe('ada-foto.md'.padStart(12, 'c'))
    expect(head + tail).toBe(name)
  })

  it('no parte un emoji por la mitad', () => {
    const name = `${'a'.repeat(30)}📸${'b'.repeat(11)}`
    expect(splitMiddle(name).tail).toBe(`📸${'b'.repeat(11)}`)
  })
})
