import { useState, type ReactNode } from 'react'
import { parseCommitMessage, splitLead, type MessageTrailer } from '../lib/commitmessage'
import { Avatar } from './ui'

/** A partir de este largo, el cuerpo se pliega para que la lista de archivos siga a mano */
const LONG_BODY = 700

const TRAILER_LABELS: Record<string, string> = {
  'co-authored-by': 'Coautor',
  'signed-off-by': 'Firmado por',
  'reviewed-by': 'Revisado por',
  'tested-by': 'Probado por',
  'acked-by': 'Aprobado por',
  'reported-by': 'Reportado por'
}

function Inline({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>
}

function WithLead({ text }: { text: string }) {
  const { lead, rest } = splitLead(text)
  return lead ? <><strong className="cm-lead">{lead}:</strong> <Inline text={rest} /></> : <Inline text={text} />
}

function Trailer({ trailer }: { trailer: MessageTrailer }) {
  return (
    <div className="cm-trailer" title={trailer.email ? `${trailer.key}: ${trailer.name} <${trailer.email}>` : `${trailer.key}: ${trailer.name}`}>
      <Avatar name={trailer.name} email={trailer.email ?? ''} size={16} />
      <span className="muted">{TRAILER_LABELS[trailer.key.toLowerCase()] ?? trailer.key}</span>
      <span className="truncate">{trailer.name}</span>
    </div>
  )
}

export function CommitTitle({ message }: { message: string }) {
  const { type, scope, breaking, title } = parseCommitMessage(message)
  return (
    <>
      {type && (
        <div className="cm-chips">
          <span className={`cm-type cm-type-${type}`}>{type}</span>
          {scope && <span className="cm-scope">{scope}</span>}
          {breaking && <span className="cm-breaking">rompe compatibilidad</span>}
        </div>
      )}
      <h2 className="commit-subject"><Inline text={title} /></h2>
    </>
  )
}

export function CommitBody({ message }: { message: string }) {
  const { blocks, trailers } = parseCommitMessage(message)
  const [expanded, setExpanded] = useState(false)
  if (!blocks.length && !trailers.length) return null
  const long = message.length > LONG_BODY
  const body: ReactNode = blocks.map((block, i) => {
    if (block.kind === 'heading') return <h3 key={i} className="cm-heading"><Inline text={block.text} /></h3>
    if (block.kind === 'code') return <pre key={i} className="cm-code">{block.text}</pre>
    if (block.kind === 'paragraph') {
      return (
        <p key={i}>
          {block.lines.map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {j === 0 ? <WithLead text={line} /> : <Inline text={line} />}
            </span>
          ))}
        </p>
      )
    }
    const List = block.ordered ? 'ol' : 'ul'
    return <List key={i}>{block.items.map((item, j) => <li key={j}><WithLead text={item} /></li>)}</List>
  })
  return (
    <>
      {blocks.length > 0 && (
        <div className={`cm-body ${long && !expanded ? 'cm-collapsed' : ''}`}>{body}</div>
      )}
      {long && <button className="link cm-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver todo el mensaje'}</button>}
      {trailers.length > 0 && <div className="cm-trailers">{trailers.map((t, i) => <Trailer key={i} trailer={t} />)}</div>}
    </>
  )
}
