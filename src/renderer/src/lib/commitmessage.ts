export type MessageBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }

export interface MessageTrailer {
  key: string
  name: string
  email?: string
}

export interface ParsedMessage {
  /** Tipo de Conventional Commits: `fix`, `feat`… */
  type?: string
  scope?: string
  breaking: boolean
  title: string
  blocks: MessageBlock[]
  trailers: MessageTrailer[]
}

const TYPES = new Set(['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert', 'merge', 'hotfix', 'release'])
const CONVENTIONAL = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/
const TRAILER = /^([A-Z][a-z]+(?:-[A-Za-z]+)+):\s+(.+)$/
const BULLET = /^(\s*)(?:[-*•]|(\d+)[.)])\s+(.*)$/
/** Por debajo de este largo, un salto de línea es intencional; por encima, es el ajuste a ~72 columnas de git */
const WRAP_WIDTH = 50

function parseTrailer(line: string): MessageTrailer | null {
  const match = TRAILER.exec(line)
  if (!match) return null
  const person = /^(.*?)\s*<([^>]+)>$/.exec(match[2])
  return { key: match[1], name: person ? person[1] : match[2], email: person?.[2] }
}

function parseParagraphs(chunk: string[], blocks: MessageBlock[]): void {
  let list: Extract<MessageBlock, { kind: 'list' }> | null = null
  let paragraph: string[] | null = null
  for (const line of chunk) {
    const bullet = BULLET.exec(line)
    if (bullet) {
      if (!list || list.ordered !== !!bullet[2]) blocks.push((list = { kind: 'list', ordered: !!bullet[2], items: [] }))
      list.items.push(bullet[3].trim())
      paragraph = null
    } else if (list && /^\s+\S/.test(line)) {
      // Continuación de la viñeta anterior
      list.items[list.items.length - 1] += ` ${line.trim()}`
    } else if (/^\S.{0,38}:$/.test(line) && !paragraph) {
      blocks.push({ kind: 'heading', text: line.slice(0, -1) })
      list = null
    } else {
      list = null
      if (!paragraph) blocks.push({ kind: 'paragraph', lines: (paragraph = []) })
      const last = paragraph[paragraph.length - 1]
      if (last !== undefined && last.length >= WRAP_WIDTH) paragraph[paragraph.length - 1] = `${last} ${line.trim()}`
      else paragraph.push(line.trim())
    }
  }
}

/** Interpreta un mensaje de commit sin perder texto: tipo, alcance, párrafos reunidos, listas, código y coautores. */
export function parseCommitMessage(message: string): ParsedMessage {
  const [first = '', ...rest] = message.replace(/\r\n/g, '\n').split('\n')
  const conventional = CONVENTIONAL.exec(first)
  const typed = conventional && TYPES.has(conventional[1])
  const lines = [...rest]
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()

  // Los coautores y firmas: el último grupo de líneas, si todas lo son
  let trailers: MessageTrailer[] = []
  const lastBlank = lines.findLastIndex((l) => !l.trim())
  const candidate = lines.slice(lastBlank + 1).map(parseTrailer)
  if (candidate.length && candidate.every(Boolean)) {
    trailers = candidate as MessageTrailer[]
    lines.length = Math.max(lastBlank, 0)
  }

  const blocks: MessageBlock[] = []
  let chunk: string[] = []
  const flush = (): void => {
    if (!chunk.length) return
    if (chunk.every((l) => /^( {4}|\t)/.test(l))) blocks.push({ kind: 'code', text: chunk.map((l) => l.replace(/^( {4}|\t)/, '')).join('\n') })
    else parseParagraphs(chunk, blocks)
    chunk = []
  }
  let fence: string[] | null = null
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (fence) {
        blocks.push({ kind: 'code', text: fence.join('\n') })
        fence = null
      } else {
        flush()
        fence = []
      }
    } else if (fence) fence.push(line)
    else if (line.trim()) chunk.push(line)
    else flush()
  }
  if (fence) blocks.push({ kind: 'code', text: fence.join('\n') })
  flush()

  return {
    type: typed ? conventional[1] : undefined,
    scope: typed ? conventional[2] : undefined,
    breaking: !!typed && !!conventional[3],
    title: typed ? conventional[4] : first,
    blocks,
    trailers
  }
}

/** Separa la etiqueta inicial de un texto: `WEB-03: La CSP…` → `WEB-03` y `La CSP…` */
export function splitLead(text: string): { lead?: string; rest: string } {
  const match = /^([^\s:]{2,32}):\s+(.*)$/s.exec(text)
  return match ? { lead: match[1], rest: match[2] } : { rest: text }
}
