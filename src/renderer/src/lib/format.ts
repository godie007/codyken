const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
// Fechas y horas en hora de Colombia, con a. m. / p. m.
const TIME_ZONE = 'America/Bogota'
const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })
const fullDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', hour12: true, timeZone: TIME_ZONE })

export function relativeTime(ms: number, now = Date.now()): string {
  const seconds = Math.round((ms - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'justo ahora'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 7) return relative.format(Math.round(seconds / 86400), 'day')
  return shortDate.format(ms)
}

export function formatFullDate(ms: number): string {
  return fullDate.format(ms)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function hashColor(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360} 52% 46%)`
}

export function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/')
  return index === -1 ? { dir: '', name: path } : { dir: path.slice(0, index + 1), name: path.slice(index + 1) }
}

export function repoName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

/** Para `.truncate-start`: marca el texto como izquierda a derecha, así la «/» inicial no salta al final */
export function ltr(text: string): string {
  return `\u200E${text}\u200E`
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

export function homeRelative(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~')
}
