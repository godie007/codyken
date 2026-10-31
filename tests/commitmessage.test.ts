import { describe, expect, it } from 'vitest'
import { parseCommitMessage, splitLead } from '../src/renderer/src/lib/commitmessage'

const real = `fix(seguridad): salida para teléfonos bloqueados por otra cuenta y CSP en modo reporte

MOB-04: un teléfono con trabajo sin enviar de otra cuenta bloqueaba a todos
los demás inspectores sin salida.
- localData: countUnsentLocalData/hasUnsentLocalData con \`onlySendable\`; al
  entrar otra cuenta ya no cuentan las entradas irrecuperables
  (failed con max_retries = 0) ni las fotos cuya única subida es una de esas.
  Al cerrar sesión el dueño las sigue conservando.
- claimLocalData devuelve dueño y cantidades.

WEB-03: Content-Security-Policy-Report-Only con la política completa de la
SPA. La CSP aplicada no cambia.

Docs: RN-030, App Móvil y Seguridad.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

describe('parseCommitMessage', () => {
  const parsed = parseCommitMessage(real)

  it('separa tipo, alcance y título', () => {
    expect(parsed).toMatchObject({ type: 'fix', scope: 'seguridad', breaking: false, title: 'salida para teléfonos bloqueados por otra cuenta y CSP en modo reporte' })
  })

  it('reúne las líneas que git ajustó y las viñetas partidas', () => {
    expect(parsed.blocks[0]).toEqual({ kind: 'paragraph', lines: ['MOB-04: un teléfono con trabajo sin enviar de otra cuenta bloqueaba a todos los demás inspectores sin salida.'] })
    expect(parsed.blocks[1]).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        'localData: countUnsentLocalData/hasUnsentLocalData con `onlySendable`; al entrar otra cuenta ya no cuentan las entradas irrecuperables (failed con max_retries = 0) ni las fotos cuya única subida es una de esas. Al cerrar sesión el dueño las sigue conservando.',
        'claimLocalData devuelve dueño y cantidades.'
      ]
    })
  })

  it('saca los coautores del cuerpo, pero no confunde `Docs:` ni `WEB-03:` con ellos', () => {
    expect(parsed.trailers).toEqual([{ key: 'Co-Authored-By', name: 'Claude Opus 5.5', email: 'noreply@anthropic.com' }])
    expect(parsed.blocks.at(-1)).toEqual({ kind: 'paragraph', lines: ['Docs: RN-030, App Móvil y Seguridad.'] })
    expect(parsed.blocks.length).toBe(4)
  })

  it('no pierde ninguna palabra del mensaje', () => {
    const words = (t: string): string[] => t.split(/\s+/).filter(Boolean)
    const flat = parsed.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.lines : b.kind === 'list' ? b.items : [b.text]))
    const shown = [parsed.title, ...flat, 'Co-Authored-By:', parsed.trailers[0].name, `<${parsed.trailers[0].email}>`, 'fix(seguridad):', '-', '-'].join(' ')
    expect(words(shown).sort()).toEqual(words(real).sort())
  })

  it('deja el título tal cual si no es Conventional Commits', () => {
    expect(parseCommitMessage('Merge pull request #5 from codla/x')).toMatchObject({ type: undefined, title: 'Merge pull request #5 from codla/x' })
    expect(parseCommitMessage('nota: esto no es un tipo')).toMatchObject({ type: undefined, title: 'nota: esto no es un tipo' })
    expect(parseCommitMessage('feat(api)!: quita v1')).toMatchObject({ type: 'feat', scope: 'api', breaking: true, title: 'quita v1' })
  })

  it('respeta los saltos de línea cortos, los títulos de sección y el código', () => {
    const { blocks } = parseCommitMessage('t\n\nHola\nMundo\n\nCambios:\n- uno\n\n    npm test\n\n```\na  b\n```')
    expect(blocks).toEqual([
      { kind: 'paragraph', lines: ['Hola', 'Mundo'] },
      { kind: 'heading', text: 'Cambios' },
      { kind: 'list', ordered: false, items: ['uno'] },
      { kind: 'code', text: 'npm test' },
      { kind: 'code', text: 'a  b' }
    ])
  })

  it('un mensaje de una línea no tiene cuerpo', () => {
    expect(parseCommitMessage('solo esto')).toMatchObject({ blocks: [], trailers: [] })
  })
})

describe('splitLead', () => {
  it('reconoce una etiqueta, no una frase ni una URL', () => {
    expect(splitLead('WEB-03: La CSP')).toEqual({ lead: 'WEB-03', rest: 'La CSP' })
    expect(splitLead('una frase larga: con dos puntos')).toEqual({ rest: 'una frase larga: con dos puntos' })
    expect(splitLead('https://x.co/a')).toEqual({ rest: 'https://x.co/a' })
  })
})
