import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
  title?: string
  subtitle?: string
  width?: number
  children: ReactNode
}

export function Modal({ onClose, title, subtitle, width = 480, children }: Props) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: '100%', maxWidth: width, background: 'rgba(26,39,68,0.95)', border: '1px solid rgba(0,212,255,0.20)', borderRadius: '12px', padding: '24px', fontFamily: 'Space Grotesk, sans-serif' }}
        role="dialog" aria-modal="true"
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between mb-5">
            <div>
              {title && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00D4FF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</p>}
              {subtitle && <p className="text-sm font-bold text-white mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="text-gray-600 hover:text-gray-400 text-lg leading-none">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
