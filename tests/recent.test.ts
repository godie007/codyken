import { describe, expect, it } from 'vitest'
import { matchRepos } from '../src/renderer/src/lib/repos'
import { MAX_RECENT, pushRecent, withoutRecent } from '../src/shared/recent'

const repos = ['/Users/ana/work/codyken', '/Users/ana/work/inspia', '/Users/ana/demo/tienda-web', '/Users/ana/work/api-pagos']

describe('lista de repositorios recientes', () => {
  it('al abrir un repo lo sube al principio sin duplicarlo', () => {
    expect(pushRecent(repos, '/Users/ana/work/inspia')).toEqual(['/Users/ana/work/inspia', '/Users/ana/work/codyken', '/Users/ana/demo/tienda-web', '/Users/ana/work/api-pagos'])
    expect(pushRecent(repos, '/Users/ana/nuevo')[0]).toBe('/Users/ana/nuevo')
  })

  it('recorta al máximo de recientes', () => {
    const many = Array.from({ length: MAX_RECENT }, (_, i) => `/r/${i}`)
    const next = pushRecent(many, '/r/nuevo')
    expect(next).toHaveLength(MAX_RECENT)
    expect(next[0]).toBe('/r/nuevo')
    expect(next).not.toContain(`/r/${MAX_RECENT - 1}`)
  })

  it('quitar elementos conserva el orden del resto', () => {
    expect(withoutRecent(repos, ['/Users/ana/work/inspia', '/no/esta'])).toEqual(['/Users/ana/work/codyken', '/Users/ana/demo/tienda-web', '/Users/ana/work/api-pagos'])
    expect(withoutRecent(repos, repos)).toEqual([])
  })

  it('sin búsqueda mantiene el orden; con búsqueda prioriza el nombre y acepta la ruta', () => {
    expect(matchRepos(repos, '  ')).toEqual(repos)
    expect(matchRepos(repos, 'pagos')[0]).toBe('/Users/ana/work/api-pagos')
    expect(matchRepos(repos, 'demo')).toEqual(['/Users/ana/demo/tienda-web'])
    expect(matchRepos(repos, 'tw')[0]).toBe('/Users/ana/demo/tienda-web')
    expect(matchRepos(repos, 'zzz')).toEqual([])
  })
})
