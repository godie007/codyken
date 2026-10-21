import type { ReactNode, SVGProps } from 'react'
import logoUrl from '../assets/logo.svg'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(children: ReactNode, { size = 16, ...props }: IconProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  )
}

export const Icon = {
  Branch: (p: IconProps) => base(<><circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="7" r="2.2" /><path d="M6 7.2v9.6M18 9.2c0 5-6 3.5-11.2 7.6" /></>, p),
  Cloud: (p: IconProps) => base(<path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18Z" />, p),
  Laptop: (p: IconProps) => base(<><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>, p),
  Tag: (p: IconProps) => base(<><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.3" /></>, p),
  Stash: (p: IconProps) => base(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" /></>, p),
  Pull: (p: IconProps) => base(<path d="M12 4v12M7 11l5 5 5-5M5 20h14" />, p),
  Push: (p: IconProps) => base(<path d="M12 20V8M7 13l5-5 5 5M5 4h14" />, p),
  Pop: (p: IconProps) => base(<><path d="M3 15v4h18v-4" /><path d="M12 3v10M8 7l4-4 4 4" /></>, p),
  Plus: (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p),
  Minus: (p: IconProps) => base(<path d="M5 12h14" />, p),
  Folder: (p: IconProps) => base(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />, p),
  Terminal: (p: IconProps) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>, p),
  Search: (p: IconProps) => base(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, p),
  Close: (p: IconProps) => base(<path d="M6 6l12 12M18 6 6 18" />, p),
  Check: (p: IconProps) => base(<path d="m5 12.5 4.5 4.5L19 7.5" />, p),
  Trash: (p: IconProps) => base(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, p),
  ChevronDown: (p: IconProps) => base(<path d="m6 9 6 6 6-6" />, p),
  ChevronRight: (p: IconProps) => base(<path d="m9 6 6 6-6 6" />, p),
  Commit: (p: IconProps) => base(<><circle cx="12" cy="12" r="3.5" /><path d="M3 12h5.5M15.5 12H21" /></>, p),
  Command: (p: IconProps) => base(<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />, p),
  Warning: (p: IconProps) => base(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>, p),
  Copy: (p: IconProps) => base(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>, p),
  Undo: (p: IconProps) => base(<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />, p),
  Panel: (p: IconProps) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>, p),
  PanelRight: (p: IconProps) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>, p),
  Wrap: (p: IconProps) => base(<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M15 16l-2 2 2 2M4 18h5" />, p),
  Download: (p: IconProps) => base(<path d="M12 3v12M7 10l5 5 5-5M4 21h16" />, p),
  Sparkle: (p: IconProps) => base(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />, p),
  Module: (p: IconProps) => base(<><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /><path d="M7 11v4a2 2 0 0 0 2 2h4M17 13V9a2 2 0 0 0-2-2h-4" /></>, p),
  Refresh: (p: IconProps) => base(<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />, p),
  Eye: (p: IconProps) => base(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>, p),
  EyeOff: (p: IconProps) => base(<path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />, p),
  Target: (p: IconProps) => base(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>, p),
  History: (p: IconProps) => base(<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" />, p),
  Blame: (p: IconProps) => base(<><circle cx="6" cy="7" r="2.5" /><path d="M2.5 15c.5-2.3 1.8-3.5 3.5-3.5s3 1.2 3.5 3.5M13 6h8M13 11h8M3 19h18" /></>, p),
  Tree: (p: IconProps) => base(<path d="M4 4h6M7 4v14h4M7 11h4M15 9h5v4h-5zM15 16h5v4h-5zM15 2h5v4h-5z" />, p),
  List: (p: IconProps) => base(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />, p),
  Compare: (p: IconProps) => base(<path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 21V9M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 6h5M13 3l3 3-3 3M14 18H9M11 15l-3 3 3 3" />, p),
  Swap: (p: IconProps) => base(<path d="M7 4l-4 4 4 4M3 8h14M17 12l4 4-4 4M21 16H7" />, p),
  Rebase: (p: IconProps) => base(<path d="M6 3v18M6 7h6a4 4 0 0 1 4 4v10M13 18l3 3 3-3" />, p),
  Worktree: (p: IconProps) => base(<path d="M3 6h7l2 2h9v11H3zM12 12v5M12 12h4" />, p),
  PullRequest: (p: IconProps) => base(<path d="M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v12M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 15V8a2 2 0 0 0-2-2h-4M14 3l-3 3 3 3" />, p),
  Lfs: (p: IconProps) => base(<path d="M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4" />, p),
  Edit: (p: IconProps) => base(<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />, p),
  Merge3: (p: IconProps) => base(<path d="M3 4h7v7H3zM14 4h7v7h-7zM8 14h8v7H8zM6.5 11v1.5H12V14M17.5 11v1.5H12" />, p),
  External: (p: IconProps) => base(<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />, p),
  Redo: (p: IconProps) => base(<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />, p)
}

/** Hongo nuclear con onda de choque; como imagen para que sus filtros e ids no choquen con los del resto de la UI */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="" aria-hidden draggable={false} style={{ display: 'block' }} />
}
