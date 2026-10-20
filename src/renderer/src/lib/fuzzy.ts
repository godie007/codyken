/** Puntuación de coincidencia difusa: las letras deben aparecer en orden; premia tramos seguidos e inicios de palabra. */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct !== -1) return 1000 - direct * 2 - (t.length - q.length) * 0.1
  let score = 0
  let ti = 0
  let streak = 0
  for (const char of q) {
    const found = t.indexOf(char, ti)
    if (found === -1) return null
    const atWordStart = found === 0 || /[\s/_\-.:]/.test(t[found - 1])
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 5 + (atWordStart ? 8 : 0) - Math.min(found - ti, 10)
    ti = found + 1
  }
  return score - t.length * 0.1
}
