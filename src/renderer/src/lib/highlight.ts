import hljs from 'highlight.js/lib/common'

const BY_EXTENSION: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin',
  swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php',
  sh: 'bash', zsh: 'bash', bash: 'bash', json: 'json', jsonc: 'json', yml: 'yaml', yaml: 'yaml',
  toml: 'ini', ini: 'ini', env: 'ini', md: 'markdown', css: 'css', scss: 'scss', less: 'less',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml', sql: 'sql', graphql: 'graphql',
  gql: 'graphql', lua: 'lua', pl: 'perl', r: 'r', m: 'objectivec', mk: 'makefile'
}

export function languageFor(path: string): string | null {
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'makefile') return 'makefile'
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
  const lang = BY_EXTENSION[ext] ?? ext
  return lang && hljs.getLanguage(lang) ? lang : null
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const cache = new Map<string, string>()

/** Devuelve HTML seguro (highlight.js escapa el contenido). Se resalta línea a línea. */
export function highlightCode(text: string, lang: string | null): string {
  if (!lang || !text || text.length > 2000) return escapeHtml(text)
  const key = `${lang}\0${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  let html: string
  try {
    html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
  } catch {
    html = escapeHtml(text)
  }
  if (cache.size > 20000) cache.clear()
  cache.set(key, html)
  return html
}
