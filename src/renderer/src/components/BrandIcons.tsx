import { Cloud, Compass, SquareTerminal } from 'lucide-react'
import type { WorkspaceIcon } from '@shared/workspaces'

export interface BrandIconProps {
  size?: number
  className?: string
}

/** Antigravity orbit mark — ring, orbiting electron, warm core. */
export function OrbitMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4.2"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.8"
        transform="rotate(-24 12 12)"
      />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      <circle cx="20.4" cy="7.6" r="1.7" fill="currentColor" />
    </svg>
  )
}

export function GitHubMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function VercelMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 3.2 22.5 21H1.5L12 3.2z" />
    </svg>
  )
}

export function GeminiMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c.62 5.4 4.6 9.38 10 10-5.4.62-9.38 4.6-10 10-.62-5.4-4.6-9.38-10-10 5.4-.62 9.38-4.6 10-10z" />
    </svg>
  )
}

export function SupabaseMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </svg>
  )
}

export function AiStudioMark({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1.8l2.5 7.7 7.7 2.5-7.7 2.5L12 22.2l-2.5-7.7L1.8 12l7.7-2.5L12 1.8z" />
      <circle cx="19.4" cy="4.6" r="1.8" opacity="0.7" />
    </svg>
  )
}

/** Google "G" for the sign-in button (brand marks are inline SVG, not lucide). */
export function GoogleMark({ size = 16, className = '' }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.97 11.97 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}

export interface WorkspaceGlyphProps extends BrandIconProps {
  icon: WorkspaceIcon
}

/** Maps a workspace icon key to its brand SVG or a lucide glyph. */
export function WorkspaceGlyph({ icon, size = 20, className = '' }: WorkspaceGlyphProps) {
  switch (icon) {
    case 'orbit':
      return <OrbitMark size={size} className={className} />
    case 'github':
      return <GitHubMark size={size} className={className} />
    case 'triangle':
      return <VercelMark size={size} className={className} />
    case 'gemini':
      return <GeminiMark size={size} className={className} />
    case 'database':
      return <SupabaseMark size={size} className={className} />
    case 'sparkles':
      return <AiStudioMark size={size} className={className} />
    case 'terminal':
      return <SquareTerminal size={size} className={className} aria-hidden />
    case 'compass':
      return <Compass size={size} className={className} aria-hidden />
    case 'cloud':
      return <Cloud size={size} className={className} aria-hidden />
    default:
      return <Cloud size={size} className={className} aria-hidden />
  }
}
