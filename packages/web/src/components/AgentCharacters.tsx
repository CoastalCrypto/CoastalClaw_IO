import type { CSSProperties, ReactElement } from 'react'

export type AgentId =
  | 'general'
  | 'cfo'
  | 'cto'
  | 'coo'
  | 'product_manager'
  | 'frontend_wizard'
  | 'ux_architect'
  | 'qa_lead'
  | 'system_integrator'

interface AgentMeta {
  label: string
  color: string       // primary glow color
  svg: () => ReactElement
}

// ─── SVG characters ──────────────────────────────────────────────────────────

const General = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* face */}
    <circle cx="32" cy="30" r="16" fill="#0a1628" stroke="#00D4FF" strokeWidth="1.5"/>
    {/* hair */}
    <path d="M18 26 Q20 14 32 13 Q44 14 46 26" fill="#1a3a5c" stroke="#00D4FF" strokeWidth="1"/>
    {/* eyes */}
    <circle cx="26" cy="28" r="2.5" fill="#00D4FF" opacity="0.9"/>
    <circle cx="38" cy="28" r="2.5" fill="#00D4FF" opacity="0.9"/>
    <circle cx="27" cy="27" r="1" fill="white" opacity="0.6"/>
    <circle cx="39" cy="27" r="1" fill="white" opacity="0.6"/>
    {/* smile */}
    <path d="M26 35 Q32 40 38 35" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* collar / uniform */}
    <path d="M20 46 Q20 40 32 38 Q44 40 44 46" fill="#0d2040" stroke="#00D4FF" strokeWidth="1"/>
    <path d="M32 38 L30 43 L32 42 L34 43 Z" fill="#00D4FF" opacity="0.5"/>
    {/* star badge */}
    <path d="M32 20 L33.2 23.6 L37 23.6 L34 25.8 L35.2 29.4 L32 27.2 L28.8 29.4 L30 25.8 L27 23.6 L30.8 23.6 Z" fill="#00D4FF" opacity="0.25"/>
  </svg>
)

const CFO = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* suit */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1f35" stroke="#4ade80" strokeWidth="1"/>
    {/* tie */}
    <path d="M32 43 L30 48 L32 47 L34 48 L32 43Z" fill="#4ade80" opacity="0.7"/>
    <path d="M30 48 L32 58 L34 48 Z" fill="#4ade80" opacity="0.5"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#4ade80" strokeWidth="1.5"/>
    {/* hair — slicked back */}
    <path d="M17 24 Q20 13 32 12 Q44 13 47 24 Q40 18 32 19 Q24 18 17 24Z" fill="#1a3a2a"/>
    {/* eyes */}
    <ellipse cx="26" cy="27" rx="2.5" ry="2" fill="#4ade80" opacity="0.85"/>
    <ellipse cx="38" cy="27" rx="2.5" ry="2" fill="#4ade80" opacity="0.85"/>
    {/* serious mouth */}
    <path d="M27 34 L37 34" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
    {/* $ monocle */}
    <circle cx="38" cy="27" r="4" stroke="#4ade80" strokeWidth="0.8" opacity="0.4" fill="none"/>
    <text x="37" y="29" fontSize="4" fill="#4ade80" opacity="0.7" fontFamily="monospace">$</text>
    {/* chart lines on forehead */}
    <path d="M22 21 L25 18 L28 20 L31 17 L34 19" stroke="#4ade80" strokeWidth="0.7" opacity="0.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CTO = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* hoodie */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1f35" stroke="#a78bfa" strokeWidth="1"/>
    <path d="M27 43 Q32 50 37 43" stroke="#a78bfa" strokeWidth="1" fill="none" opacity="0.4"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#a78bfa" strokeWidth="1.5"/>
    {/* messy hair */}
    <path d="M17 25 Q18 12 32 11 Q46 12 47 25 Q44 16 36 15 Q32 14 28 15 Q22 16 17 25Z" fill="#2d1b4e"/>
    <path d="M17 25 Q20 17 24 16" stroke="#a78bfa" strokeWidth="0.5" opacity="0.4"/>
    {/* glasses */}
    <rect x="22" y="24" width="8" height="6" rx="2" stroke="#a78bfa" strokeWidth="1" fill="#0a0f1e" fillOpacity="0.6"/>
    <rect x="34" y="24" width="8" height="6" rx="2" stroke="#a78bfa" strokeWidth="1" fill="#0a0f1e" fillOpacity="0.6"/>
    <line x1="30" y1="27" x2="34" y2="27" stroke="#a78bfa" strokeWidth="1"/>
    {/* eyes behind glasses */}
    <circle cx="26" cy="27" r="1.5" fill="#a78bfa" opacity="0.9"/>
    <circle cx="38" cy="27" r="1.5" fill="#a78bfa" opacity="0.9"/>
    {/* smirk */}
    <path d="M27 35 Q33 38 38 35" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* circuit lines on cheek */}
    <path d="M46 28 L50 28 L50 32 L48 32" stroke="#a78bfa" strokeWidth="0.7" opacity="0.5" fill="none"/>
    <circle cx="50" cy="28" r="1" fill="#a78bfa" opacity="0.5"/>
    <circle cx="48" cy="32" r="1" fill="#a78bfa" opacity="0.5"/>
  </svg>
)

const COO = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* blazer */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1a2e" stroke="#f59e0b" strokeWidth="1"/>
    <path d="M32 43 L28 46 L32 44 L36 46 L32 43Z" fill="#f59e0b" opacity="0.6"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#f59e0b" strokeWidth="1.5"/>
    {/* bun / hair up */}
    <ellipse cx="32" cy="14" rx="7" ry="5" fill="#2a1a05" stroke="#f59e0b" strokeWidth="0.8"/>
    <path d="M25 19 Q28 13 32 12 Q36 13 39 19" fill="#2a1a05"/>
    {/* eyes — determined */}
    <ellipse cx="26" cy="28" rx="2.5" ry="2" fill="#f59e0b" opacity="0.85"/>
    <ellipse cx="38" cy="28" rx="2.5" ry="2" fill="#f59e0b" opacity="0.85"/>
    {/* slight frown — focused */}
    <path d="M27 35 Q32 33 37 35" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* clipboard lines */}
    <rect x="47" y="24" width="8" height="10" rx="1" fill="#0d1a2e" stroke="#f59e0b" strokeWidth="0.7" opacity="0.6"/>
    <line x1="48.5" y1="27" x2="53.5" y2="27" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5"/>
    <line x1="48.5" y1="29" x2="53.5" y2="29" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5"/>
    <line x1="48.5" y1="31" x2="51.5" y2="31" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5"/>
    {/* checkmark */}
    <path d="M49 33 L50.5 34.5 L53 32" stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" opacity="0.7"/>
  </svg>
)

const ProductManager = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* casual top */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1f35" stroke="#f472b6" strokeWidth="1"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#f472b6" strokeWidth="1.5"/>
    {/* wavy hair */}
    <path d="M17 25 Q18 11 32 11 Q46 11 47 25 Q44 14 38 14 Q34 13 30 14 Q24 15 22 18 Q20 20 17 25Z" fill="#3b0a2e"/>
    <path d="M17 25 Q19 20 22 18" stroke="#f472b6" strokeWidth="0.6" opacity="0.4"/>
    {/* bright eyes */}
    <circle cx="26" cy="27" r="2.5" fill="#f472b6" opacity="0.9"/>
    <circle cx="38" cy="27" r="2.5" fill="#f472b6" opacity="0.9"/>
    <circle cx="27" cy="26" r="1" fill="white" opacity="0.5"/>
    <circle cx="39" cy="26" r="1" fill="white" opacity="0.5"/>
    {/* wide smile */}
    <path d="M25 34 Q32 40 39 34" stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* lightbulb */}
    <circle cx="52" cy="18" r="5" fill="#0a1628" stroke="#f472b6" strokeWidth="0.8" opacity="0.7"/>
    <path d="M50 18 Q52 15 54 18 Q54 21 52 22 L52 24" stroke="#f472b6" strokeWidth="0.7" fill="none" opacity="0.6" strokeLinecap="round"/>
    <line x1="51" y1="24" x2="53" y2="24" stroke="#f472b6" strokeWidth="0.7" opacity="0.6"/>
    {/* freckle dots */}
    <circle cx="28" cy="32" r="0.8" fill="#f472b6" opacity="0.4"/>
    <circle cx="30" cy="33" r="0.8" fill="#f472b6" opacity="0.4"/>
    <circle cx="36" cy="32" r="0.8" fill="#f472b6" opacity="0.4"/>
    <circle cx="34" cy="33" r="0.8" fill="#f472b6" opacity="0.4"/>
  </svg>
)

const FrontendWizard = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* robe */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1635" stroke="#38bdf8" strokeWidth="1"/>
    {/* wizard hat */}
    <path d="M32 3 L20 20 L44 20 Z" fill="#0d1635" stroke="#38bdf8" strokeWidth="1"/>
    <path d="M18 20 L46 20 L44 23 L20 23 Z" fill="#1a2a4a" stroke="#38bdf8" strokeWidth="0.8"/>
    {/* stars on hat */}
    <circle cx="28" cy="12" r="1" fill="#38bdf8" opacity="0.7"/>
    <circle cx="34" cy="8" r="0.7" fill="#38bdf8" opacity="0.5"/>
    <circle cx="36" cy="14" r="0.8" fill="#38bdf8" opacity="0.6"/>
    {/* face */}
    <circle cx="32" cy="31" r="13" fill="#0a1628" stroke="#38bdf8" strokeWidth="1.5"/>
    {/* eyes — wide + sparkle */}
    <circle cx="27" cy="30" r="2.5" fill="#38bdf8" opacity="0.9"/>
    <circle cx="37" cy="30" r="2.5" fill="#38bdf8" opacity="0.9"/>
    <circle cx="28" cy="29" r="1" fill="white" opacity="0.7"/>
    <circle cx="38" cy="29" r="1" fill="white" opacity="0.7"/>
    {/* grin */}
    <path d="M26 37 Q32 42 38 37" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* wand */}
    <line x1="46" y1="40" x2="57" y2="30" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    <circle cx="57" cy="30" r="2" fill="#38bdf8" opacity="0.6"/>
    {/* sparkles from wand */}
    <line x1="58" y1="27" x2="60" y2="25" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5"/>
    <line x1="60" y1="30" x2="62" y2="29" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5"/>
    <line x1="59" y1="33" x2="61" y2="34" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5"/>
  </svg>
)

const UXArchitect = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* turtleneck */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1f35" stroke="#34d399" strokeWidth="1"/>
    <rect x="27" y="43" width="10" height="6" rx="2" fill="#0d2a20" stroke="#34d399" strokeWidth="0.8" opacity="0.7"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#34d399" strokeWidth="1.5"/>
    {/* side-swept hair */}
    <path d="M17 24 Q18 11 32 11 Q40 11 46 17 Q44 12 38 12 Q30 11 22 15 Q18 18 17 24Z" fill="#0d2a20"/>
    <path d="M46 17 Q48 20 47 25" stroke="#34d399" strokeWidth="0.6" fill="none" opacity="0.4"/>
    {/* eyes — thoughtful, slightly narrowed */}
    <path d="M23 27 Q26 25 29 27 Q26 30 23 27Z" fill="#34d399" opacity="0.85"/>
    <path d="M35 27 Q38 25 41 27 Q38 30 35 27Z" fill="#34d399" opacity="0.85"/>
    {/* serene smile */}
    <path d="M27 35 Q32 38 37 35" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* wireframe grid accent */}
    <rect x="4" y="26" width="8" height="8" stroke="#34d399" strokeWidth="0.6" fill="none" opacity="0.4"/>
    <line x1="8" y1="26" x2="8" y2="34" stroke="#34d399" strokeWidth="0.4" opacity="0.3"/>
    <line x1="4" y1="30" x2="12" y2="30" stroke="#34d399" strokeWidth="0.4" opacity="0.3"/>
    <circle cx="4" cy="26" r="0.8" fill="#34d399" opacity="0.5"/>
    <circle cx="12" cy="26" r="0.8" fill="#34d399" opacity="0.5"/>
    <circle cx="4" cy="34" r="0.8" fill="#34d399" opacity="0.5"/>
    <circle cx="12" cy="34" r="0.8" fill="#34d399" opacity="0.5"/>
  </svg>
)

const QALead = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* detective coat */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#1a1008" stroke="#fbbf24" strokeWidth="1"/>
    <path d="M32 43 L30 46 L32 45 L34 46 L32 43Z" fill="#fbbf24" opacity="0.5"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#fbbf24" strokeWidth="1.5"/>
    {/* detective hat */}
    <path d="M17 22 Q20 16 32 15 Q44 16 47 22 L17 22Z" fill="#1a1008" stroke="#fbbf24" strokeWidth="0.8"/>
    <rect x="14" y="22" width="36" height="3" rx="1" fill="#1a1008" stroke="#fbbf24" strokeWidth="0.8"/>
    {/* squinting eyes */}
    <path d="M23 27 Q26 25 29 27" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M35 27 Q38 25 41 27" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* magnifying glass */}
    <circle cx="42" cy="36" r="5" stroke="#fbbf24" strokeWidth="1.2" fill="none" opacity="0.7"/>
    <line x1="38" y1="40" x2="34" y2="44" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    <circle cx="42" cy="36" r="2.5" stroke="#fbbf24" strokeWidth="0.6" fill="#0a1628" opacity="0.5"/>
    {/* smirk */}
    <path d="M26 35 Q29 38 36 35" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* bug found indicator */}
    <circle cx="19" cy="38" r="3" fill="#0a1628" stroke="#fbbf24" strokeWidth="0.7" opacity="0.5"/>
    <text x="17.5" y="40" fontSize="4" fill="#fbbf24" opacity="0.8" fontFamily="monospace">!</text>
  </svg>
)

const SystemIntegrator = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* tech vest */}
    <path d="M16 64 Q16 46 32 43 Q48 46 48 64" fill="#0d1f35" stroke="#fb923c" strokeWidth="1"/>
    {/* face */}
    <circle cx="32" cy="28" r="15" fill="#0a1628" stroke="#fb923c" strokeWidth="1.5"/>
    {/* short hair */}
    <path d="M17 25 Q19 14 32 13 Q45 14 47 25 Q44 17 32 17 Q20 17 17 25Z" fill="#1a0d05"/>
    {/* eyes — steady */}
    <circle cx="26.5" cy="28" r="2.5" fill="#fb923c" opacity="0.85"/>
    <circle cx="37.5" cy="28" r="2.5" fill="#fb923c" opacity="0.85"/>
    <circle cx="27.5" cy="27" r="1" fill="white" opacity="0.5"/>
    <circle cx="38.5" cy="27" r="1" fill="white" opacity="0.5"/>
    {/* neutral confident mouth */}
    <path d="M27 35 Q32 37 37 35" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* connection nodes */}
    <circle cx="5" cy="20" r="2" fill="#fb923c" opacity="0.6"/>
    <circle cx="5" cy="28" r="2" fill="#fb923c" opacity="0.6"/>
    <circle cx="5" cy="36" r="2" fill="#fb923c" opacity="0.6"/>
    <line x1="7" y1="20" x2="17" y2="26" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
    <line x1="7" y1="28" x2="17" y2="28" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
    <line x1="7" y1="36" x2="17" y2="30" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
    <circle cx="59" cy="20" r="2" fill="#fb923c" opacity="0.6"/>
    <circle cx="59" cy="28" r="2" fill="#fb923c" opacity="0.6"/>
    <circle cx="59" cy="36" r="2" fill="#fb923c" opacity="0.6"/>
    <line x1="57" y1="20" x2="47" y2="26" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
    <line x1="57" y1="28" x2="47" y2="28" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
    <line x1="57" y1="36" x2="47" y2="30" stroke="#fb923c" strokeWidth="0.7" opacity="0.5"/>
  </svg>
)

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AGENT_META: Record<AgentId, AgentMeta> = {
  general:           { label: 'General',    color: '#00D4FF', svg: General },
  cfo:               { label: 'CFO',        color: '#4ade80', svg: CFO },
  cto:               { label: 'CTO',        color: '#a78bfa', svg: CTO },
  coo:               { label: 'COO',        color: '#f59e0b', svg: COO },
  product_manager:   { label: 'PM',         color: '#f472b6', svg: ProductManager },
  frontend_wizard:   { label: 'Frontend',   color: '#38bdf8', svg: FrontendWizard },
  ux_architect:      { label: 'UX',         color: '#34d399', svg: UXArchitect },
  qa_lead:           { label: 'QA',         color: '#fbbf24', svg: QALead },
  system_integrator: { label: 'SysInt',     color: '#fb923c', svg: SystemIntegrator },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  agents: Array<{ id: string; name: string; active: boolean }>
  selected: string | null   // null = auto-routing
  onSelect: (id: string | null) => void
  vertical?: boolean
}

export function AgentCharacters({ agents, selected, onSelect, vertical = false }: Props) {
  const active = agents.filter(a => a.active)

  if (vertical) {
    return (
      <>
        {/* AUTO button */}
        <button
          onClick={() => onSelect(null)}
          title="Auto-route to best agent"
          className={`flex flex-col items-center gap-1 transition-all duration-200 ${
            selected === null ? 'opacity-100' : 'opacity-30 hover:opacity-60'
          }`}
        >
          <div
            className="w-10 h-10 rounded-full border flex items-center justify-center text-[9px] font-mono transition-all"
            style={selected === null
              ? { borderColor: '#00D4FF', background: 'rgba(0,212,255,0.15)', color: '#00D4FF', boxShadow: '0 0 10px rgba(0,212,255,0.35)' }
              : { borderColor: 'rgba(255,255,255,0.08)', background: 'transparent', color: '#6b7280' }
            }
          >
            AUTO
          </div>
          <span className="text-[8px] font-mono" style={{ color: selected === null ? '#00D4FF' : '#4b5563' }}>
            auto
          </span>
        </button>

        {/* Divider */}
        <div className="w-8 h-px bg-white/5 my-1 shrink-0" />

        {/* Agent portraits */}
        {active.map(agent => {
          const meta = AGENT_META[agent.id as AgentId]
          if (!meta) return null
          const isSelected = selected === agent.id
          const glowColor = meta.color

          const ringStyle: CSSProperties = isSelected
            ? { boxShadow: `0 0 0 2px ${glowColor}, 0 0 18px ${glowColor}55` }
            : {}

          return (
            <button
              key={agent.id}
              onClick={() => onSelect(isSelected ? null : agent.id)}
              title={agent.name}
              className={`flex flex-col items-center gap-1 transition-all duration-200 ${
                isSelected ? 'scale-110' : 'opacity-35 hover:opacity-75 hover:scale-105'
              }`}
            >
              <div
                className="w-11 h-11 rounded-full overflow-hidden border transition-all duration-200"
                style={{
                  borderColor: isSelected ? glowColor : 'rgba(255,255,255,0.06)',
                  background: 'rgba(5,13,26,0.9)',
                  ...ringStyle,
                }}
              >
                <meta.svg />
              </div>
              <span
                className="text-[8px] font-mono tracking-wide leading-none transition-colors"
                style={{ color: isSelected ? glowColor : '#374151' }}
              >
                {meta.label}
              </span>
            </button>
          )
        })}
      </>
    )
  }

  // Horizontal layout (kept for potential future use)
  return (
    <div className="flex items-end gap-3 overflow-x-auto py-2 px-1 scrollbar-none">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 flex flex-col items-center gap-1 transition-all ${
          selected === null ? 'opacity-100' : 'opacity-40 hover:opacity-70'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-mono transition-all ${
            selected === null
              ? 'border-cyan-400 bg-cyan-900/40 text-cyan-300 shadow-[0_0_10px_rgba(0,212,255,0.4)]'
              : 'border-gray-700 bg-gray-900 text-gray-500'
          }`}
        >
          AUTO
        </div>
        <span className="text-[9px] font-mono text-gray-500">auto</span>
      </button>
      <div className="w-px h-10 bg-gray-800 shrink-0" />
      {active.map(agent => {
        const meta = AGENT_META[agent.id as AgentId]
        if (!meta) return null
        const isSelected = selected === agent.id
        const glowColor = meta.color
        const ringStyle: CSSProperties = isSelected
          ? { boxShadow: `0 0 0 2px ${glowColor}, 0 0 16px ${glowColor}66` }
          : {}
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(isSelected ? null : agent.id)}
            className={`shrink-0 flex flex-col items-center gap-1 transition-all duration-200 ${
              isSelected ? 'scale-110' : 'opacity-50 hover:opacity-80 hover:scale-105'
            }`}
            title={agent.name}
          >
            <div
              className="w-12 h-12 rounded-full overflow-hidden border transition-all duration-200"
              style={{ borderColor: isSelected ? glowColor : 'rgba(255,255,255,0.08)', background: 'rgba(5,13,26,0.8)', ...ringStyle }}
            >
              <meta.svg />
            </div>
            <span className="text-[9px] font-mono tracking-wide transition-colors" style={{ color: isSelected ? glowColor : 'rgb(107,114,128)' }}>
              {meta.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
