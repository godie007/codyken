import { spawn } from 'node:child_process'
import type { PrProvider, PullRequest, PullRequestInfo } from '../shared/types'
import { ENV, getRemotes, GitError } from './git'

const CLI_TIMEOUT = 30_000
const CLI_ENV: NodeJS.ProcessEnv = { ...ENV, GH_PROMPT_DISABLED: '1', NO_PROMPT: '1', GLAB_NO_PROMPT: '1', NO_COLOR: '1', GH_NO_UPDATE_NOTIFIER: '1' }

class CliMissing extends Error {}

/** Ejecuta gh o glab sin shell ni preguntas; falla con CliMissing si no está instalado. */
function cli(command: 'gh' | 'glab' | 'ssh', args: string[], cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: CLI_ENV })
    const out: Buffer[] = []
    const err: Buffer[] = []
    const timer = setTimeout(() => child.kill(), CLI_TIMEOUT)
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(error.code === 'ENOENT' ? new CliMissing(command) : error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) return resolvePromise(Buffer.concat(out).toString('utf8'))
      const message = Buffer.concat(err).toString('utf8').trim() || Buffer.concat(out).toString('utf8').trim()
      reject(new GitError(signal ? `${command} tardó demasiado en responder` : message || `${command} terminó con código ${code}`))
    })
    child.stdin.end()
  })
}

export interface RemoteLocation {
  provider: PrProvider | null
  host: string
  slug: string
  remote: string
}

/** Extrae servidor y ruta de una URL de remoto (SSH corto, ssh:// o https://). */
export function parseRemoteUrl(url: string): { host: string; path: string } | null {
  const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/)(.+)$/.exec(url)
  const full = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(url)
  const match = full ?? (url.includes('://') ? null : scp)
  if (!match) return null
  const path = match[2].replace(/\.git\/?$/, '').replace(/^\/+|\/+$/g, '')
  return path.includes('/') ? { host: match[1].toLowerCase(), path } : null
}

export function providerOf(host: string): PrProvider | null {
  if (host === 'github.com' || host === 'ssh.github.com') return 'github'
  if (host === 'gitlab.com' || host.includes('gitlab')) return 'gitlab'
  return null
}

/** Un alias de ~/.ssh/config (p. ej. "trabajo-github") se traduce a su HostName real. */
async function realHost(host: string, cwd: string): Promise<string> {
  if (providerOf(host) || host.includes('.') || !/^[\w-]+$/.test(host)) return host
  try {
    const out = await cli('ssh', ['-G', host], cwd)
    return /^hostname (.+)$/m.exec(out)?.[1]?.trim().toLowerCase() ?? host
  } catch {
    return host
  }
}

export async function locateRemote(repo: string): Promise<RemoteLocation | null> {
  const remotes = await getRemotes(repo)
  const remote = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  if (!remote) return null
  const parsed = parseRemoteUrl(remote.url)
  if (!parsed) return null
  const host = await realHost(parsed.host, repo)
  return { provider: providerOf(host), host: host === 'ssh.github.com' ? 'github.com' : host, slug: parsed.path, remote: remote.name }
}

export function parseGithubPrs(json: string): PullRequest[] {
  const list = JSON.parse(json) as { number: number; title: string; author?: { login?: string }; headRefName: string; baseRefName: string; url: string; isDraft: boolean; updatedAt: string }[]
  return list.map((pr) => ({ number: pr.number, title: pr.title, author: pr.author?.login ?? '', head: pr.headRefName, base: pr.baseRefName, url: pr.url, draft: pr.isDraft, updatedAt: Date.parse(pr.updatedAt) || 0 }))
}

export function parseGitlabMrs(json: string): PullRequest[] {
  const list = JSON.parse(json) as { iid: number; title: string; author?: { username?: string }; source_branch: string; target_branch: string; web_url: string; draft?: boolean; work_in_progress?: boolean; updated_at: string }[]
  return list.map((mr) => ({ number: mr.iid, title: mr.title, author: mr.author?.username ?? '', head: mr.source_branch, base: mr.target_branch, url: mr.web_url, draft: !!(mr.draft ?? mr.work_in_progress), updatedAt: Date.parse(mr.updated_at) || 0 }))
}

const GH_FIELDS = 'number,title,author,headRefName,baseRefName,url,isDraft,updatedAt'

export async function getPullRequests(repo: string): Promise<PullRequestInfo> {
  const location = await locateRemote(repo)
  if (!location?.provider) return { provider: null, slug: location?.slug ?? null, remote: location?.remote ?? null, webUrl: null, cliMissing: false, error: null, items: [] }
  const { provider, host, slug, remote } = location
  const webUrl = `https://${host}/${slug}`
  const base = { provider, slug, remote, webUrl, cliMissing: false, error: null }
  try {
    const items =
      provider === 'github'
        ? parseGithubPrs(await cli('gh', ['pr', 'list', '--repo', host === 'github.com' ? slug : `${host}/${slug}`, '--state', 'open', '--limit', '50', '--json', GH_FIELDS], repo))
        : parseGitlabMrs(await cli('glab', ['mr', 'list', '--repo', webUrl, '--per-page', '50', '--output', 'json'], repo))
    return { ...base, items }
  } catch (error) {
    if (error instanceof CliMissing) return { ...base, cliMissing: true, items: [] }
    const message = error instanceof Error ? error.message : String(error)
    const notLogged = /auth login|not logged|authenticat|401/i.test(message)
    return { ...base, cliMissing: notLogged, error: message, items: [] }
  }
}

export async function checkoutPullRequest(repo: string, number: number): Promise<void> {
  if (!Number.isInteger(number) || number <= 0) throw new GitError('Número de pull request no válido')
  const location = await locateRemote(repo)
  if (!location?.provider) throw new GitError('El remoto no es de GitHub ni de GitLab')
  try {
    if (location.provider === 'github') await cli('gh', ['pr', 'checkout', String(number), '--repo', location.host === 'github.com' ? location.slug : `${location.host}/${location.slug}`], repo)
    else await cli('glab', ['mr', 'checkout', String(number), '--repo', `https://${location.host}/${location.slug}`], repo)
  } catch (error) {
    if (error instanceof CliMissing) throw new GitError(location.provider === 'github' ? 'Instala GitHub CLI (gh) e inicia sesión con "gh auth login".' : 'Instala GitLab CLI (glab) e inicia sesión con "glab auth login".')
    throw error
  }
}
