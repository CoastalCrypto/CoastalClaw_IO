/**
 * Shared inline style constants for pages that use the dark-console panel aesthetic.
 * Tailwind-based pages (Login, Tools, Skills, Channels, etc.) use index.css utility
 * classes instead; these tokens are for inline-styled pages (Pipeline, PipelineRun,
 * Agents modals) so they all reference the same values.
 */
import type { CSSProperties } from 'react'

export const PAGE_BG: CSSProperties = {
  background: '#050a0f',
  minHeight: '100vh',
  fontFamily: 'Space Grotesk, sans-serif',
}

export const PANEL: CSSProperties = {
  background: 'rgba(26,39,68,0.80)',
  border: '1px solid rgba(0,229,255,0.15)',
  borderRadius: '12px',
  padding: '20px',
}

export const PANEL_ACTIVE: CSSProperties = {
  ...PANEL,
  border: '1px solid rgba(0,229,255,0.30)',
}

export const PANEL_SUCCESS: CSSProperties = {
  ...PANEL,
  borderColor: 'rgba(0,230,118,0.20)',
}

export const PANEL_ERROR: CSSProperties = {
  ...PANEL,
  borderColor: 'rgba(255,82,82,0.25)',
  background: 'rgba(255,82,82,0.05)',
}

export const INPUT_STYLE: CSSProperties = {
  background: 'rgba(5,10,15,0.8)',
  border: '1px solid rgba(0,229,255,0.20)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
}

export const BTN_CYAN: CSSProperties = {
  background: 'rgba(0,229,255,0.12)',
  border: '1px solid rgba(0,229,255,0.30)',
  color: '#00e5ff',
  borderRadius: '8px',
  padding: '6px 14px',
  fontSize: '12px',
  fontFamily: 'Space Grotesk, sans-serif',
  cursor: 'pointer',
}

export const BTN_RED: CSSProperties = {
  background: 'rgba(255,82,82,0.10)',
  border: '1px solid rgba(255,82,82,0.25)',
  color: '#ff5252',
  borderRadius: '8px',
  padding: '6px 14px',
  fontSize: '12px',
  fontFamily: 'Space Grotesk, sans-serif',
  cursor: 'pointer',
}

export const MONO: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
}

export const SECTION_LABEL: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '10px',
  color: '#00e5ff',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

// Status colours (use as `color:` values)
export const COLOR = {
  cyan:    '#00e5ff',
  green:   '#00e676',
  amber:   '#ffb300',
  red:     '#ff5252',
  muted:   '#94adc4',
  dim:     'rgba(255,255,255,0.25)',
  dimPlus: 'rgba(255,255,255,0.45)',
} as const
