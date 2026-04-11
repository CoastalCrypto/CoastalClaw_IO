/**
 * AgentThinkingAnimation
 *
 * Three distinct SVG/CSS animations — one per executive domain — shown
 * while the agent is generating a response.
 *
 * COO  → Wave Orchestration  (coordinated node-wave, workflow cadence)
 * CFO  → Data Pulse          (rising bars with financial data-stream feel)
 * CTO  → Neural Circuit      (pulsing circuit-board with connected nodes)
 * General → Claw Pulse       (the Coastal.AI claw mark with a heartbeat glow)
 */

import React from 'react'

// ─── shared colour tokens ────────────────────────────────────────────────────
const C = {
  bg:      '#0a1628',
  cyan:    '#00e5ff',
  teal:    '#0094c8',
  navy:    '#004e70',
  dim:     '#0d4f6b',
  white:   '#e8f6fb',
}

// ─── keyframe injection ──────────────────────────────────────────────────────
// Injected once into a <style> tag so keyframes are available globally.
const KEYFRAMES = `
@keyframes cc-wave {
  0%,100% { transform: translateY(0);   opacity:.9; }
  50%      { transform: translateY(-8px); opacity:1; }
}
@keyframes cc-bar {
  0%,100% { transform: scaleY(.3); opacity:.5; }
  50%      { transform: scaleY(1);  opacity:1; }
}
@keyframes cc-pulse-ring {
  0%   { r: 3; opacity: 1; }
  100% { r: 12; opacity: 0; }
}
@keyframes cc-node-glow {
  0%,100% { opacity:.4; }
  50%      { opacity:1;  }
}
@keyframes cc-claw-beat {
  0%,100% { opacity:.5; filter: drop-shadow(0 0 2px #00e5ff); }
  50%      { opacity:1;  filter: drop-shadow(0 0 8px #00e5ff); }
}
@keyframes cc-flow {
  0%   { stroke-dashoffset: 40; }
  100% { stroke-dashoffset: 0; }
}
`

function useInjectKeyframes() {
  React.useEffect(() => {
    if (document.getElementById('cc-anim-kf')) return
    const style = document.createElement('style')
    style.id = 'cc-anim-kf'
    style.textContent = KEYFRAMES
    document.head.appendChild(style)
  }, [])
}

// ─── COO: Wave Orchestration ─────────────────────────────────────────────────
function CooAnimation() {
  useInjectKeyframes()
  const nodes = [0, 1, 2, 3, 4, 5, 6]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={80} height={48} viewBox="0 0 80 48" fill="none">
        {/* connection lines */}
        {nodes.slice(0, -1).map((_, i) => (
          <line
            key={i}
            x1={6 + i * 11} y1={24 + Math.sin(i * 0.9) * 10}
            x2={6 + (i + 1) * 11} y2={24 + Math.sin((i + 1) * 0.9) * 10}
            stroke={C.teal} strokeWidth={1} opacity={0.4}
            strokeDasharray="4 2"
            style={{ animation: `cc-flow 1.2s linear infinite`, animationDelay: `${i * 0.15}s` }}
          />
        ))}
        {/* nodes */}
        {nodes.map((_, i) => {
          const cx = 6 + i * 11
          const cy = 24 + Math.sin(i * 0.9) * 10
          const delay = i * 0.13
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={3} fill={C.teal}
                style={{ animation: `cc-wave 1.4s ease-in-out infinite`, animationDelay: `${delay}s` }} />
              <circle cx={cx} cy={cy} r={3} fill="none" stroke={C.cyan} strokeWidth={1}
                style={{ animation: `cc-pulse-ring 1.4s ease-out infinite`, animationDelay: `${delay}s` }} />
            </g>
          )
        })}
        {/* wave crest */}
        <path
          d={`M4 38 Q20 30 40 36 Q60 42 76 34`}
          stroke={C.cyan} strokeWidth={1.5} opacity={0.3}
          fill="none" strokeDasharray="6 3"
          style={{ animation: `cc-flow 2s linear infinite` }}
        />
      </svg>
      <div>
        <div style={{ color: C.cyan, fontSize: 11, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 2 }}>COO</div>
        <div style={{ color: C.white, fontSize: 12, opacity: 0.6 }}>Orchestrating…</div>
      </div>
    </div>
  )
}

// ─── CFO: Data Pulse ─────────────────────────────────────────────────────────
function CfoAnimation() {
  useInjectKeyframes()
  const bars = [0.4, 0.7, 0.5, 1.0, 0.6, 0.85, 0.45, 0.9, 0.55, 0.75]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={80} height={48} viewBox="0 0 80 48" fill="none">
        {/* baseline */}
        <line x1={4} y1={44} x2={76} y2={44} stroke={C.dim} strokeWidth={1} />
        {/* bars */}
        {bars.map((h, i) => {
          const x = 5 + i * 7.4
          const maxH = 34
          return (
            <rect
              key={i}
              x={x} y={44 - h * maxH}
              width={5} height={h * maxH}
              rx={1.5}
              fill={i === 3 || i === 7 ? C.cyan : C.teal}
              opacity={0.85}
              style={{
                transformOrigin: `${x + 2.5}px 44px`,
                animation: `cc-bar 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          )
        })}
        {/* data-stream line */}
        <polyline
          points="4,28 12,22 20,30 28,18 36,24 44,14 52,20 60,16 68,22 76,18"
          stroke={C.cyan} strokeWidth={1.5} fill="none" opacity={0.5}
          strokeDasharray="6 3"
          style={{ animation: `cc-flow 1.8s linear infinite` }}
        />
      </svg>
      <div>
        <div style={{ color: C.cyan, fontSize: 11, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 2 }}>CFO</div>
        <div style={{ color: C.white, fontSize: 12, opacity: 0.6 }}>Analysing…</div>
      </div>
    </div>
  )
}

// ─── CTO: Neural Circuit ─────────────────────────────────────────────────────
function CtoAnimation() {
  useInjectKeyframes()
  // node positions [cx, cy, delay]
  const nodes: [number, number, number][] = [
    [40, 24, 0],
    [20, 14, 0.2],
    [60, 14, 0.4],
    [14, 34, 0.6],
    [66, 34, 0.8],
    [40, 42, 1.0],
  ]
  const edges: [number, number][] = [
    [0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,5],[4,5]
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={80} height={52} viewBox="0 0 80 52" fill="none">
        {/* circuit grid dots */}
        {[16,32,48,64].map(x => [12,28,44].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.7} fill={C.dim} opacity={0.4} />
        )))}
        {/* edges */}
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]} y1={nodes[a][1]}
            x2={nodes[b][0]} y2={nodes[b][1]}
            stroke={C.teal} strokeWidth={1} opacity={0.45}
            strokeDasharray="5 3"
            style={{ animation: `cc-flow 1.6s linear infinite`, animationDelay: `${i * 0.2}s` }}
          />
        ))}
        {/* nodes */}
        {nodes.map(([cx, cy, delay], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={i === 0 ? 5 : 3.5}
              fill={i === 0 ? C.cyan : C.teal} opacity={0.9}
              style={{ animation: `cc-node-glow 1.4s ease-in-out infinite`, animationDelay: `${delay}s` }} />
            {i === 0 && (
              <circle cx={cx} cy={cy} r={5} fill="none" stroke={C.cyan} strokeWidth={1.5}
                style={{ animation: `cc-pulse-ring 1.6s ease-out infinite` }} />
            )}
          </g>
        ))}
      </svg>
      <div>
        <div style={{ color: C.cyan, fontSize: 11, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 2 }}>CTO</div>
        <div style={{ color: C.white, fontSize: 12, opacity: 0.6 }}>Processing…</div>
      </div>
    </div>
  )
}

// ─── General / fallback: Claw Pulse ──────────────────────────────────────────
function ClawAnimation() {
  useInjectKeyframes()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={44} height={52} viewBox="0 0 44 52" fill="none"
        style={{ animation: `cc-claw-beat 1.2s ease-in-out infinite` }}>
        {/* claw mark (scaled down from logo) */}
        <g transform="translate(22,28)">
          <path d="M0 0 C-8 -5 -14 -13 -11 -23 C-9 -32 -1 -33 3 -28 C5 -24 4 -18 0 -14"
            stroke={C.cyan} strokeWidth={2.5} fill="none" strokeLinecap="round"/>
          <path d="M0 0 C8 -5 14 -13 11 -23 C9 -32 1 -33 -3 -28 C-5 -24 -4 -18 0 -14"
            stroke={C.cyan} strokeWidth={2.5} fill="none" strokeLinecap="round"/>
          <path d="M0 0 L0 12" stroke={C.cyan} strokeWidth={2.5} strokeLinecap="round"/>
          <path d="M-11 -23 C-15 -27 -13 -32 -9 -31"
            stroke={C.white} strokeWidth={2} fill="none" strokeLinecap="round"/>
          <path d="M11 -23 C15 -27 13 -32 9 -31"
            stroke={C.white} strokeWidth={2} fill="none" strokeLinecap="round"/>
          <circle cx={-11} cy={-23} r={3} fill={C.cyan} opacity={0.8}/>
          <circle cx={11} cy={-23} r={3} fill={C.cyan} opacity={0.8}/>
          <circle cx={0} cy={0} r={4} fill={C.cyan}/>
        </g>
      </svg>
      <div>
        <div style={{ color: C.cyan, fontSize: 11, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 2 }}>AGENT</div>
        <div style={{ color: C.white, fontSize: 12, opacity: 0.6 }}>Thinking…</div>
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
export type AgentDomain = 'coo' | 'cfo' | 'cto' | 'general'

const DOMAIN_MAP: Record<AgentDomain, React.FC> = {
  coo:     CooAnimation,
  cfo:     CfoAnimation,
  cto:     CtoAnimation,
  general: ClawAnimation,
}

/**
 * Lightweight client-side keyword pre-classifier.
 * Used only to pick the animation — the server makes the real routing decision.
 */
export function guessDomain(message: string): AgentDomain {
  const m = message.toLowerCase()
  if (/\b(budget|cash|invoice|financ|forecast|revenue|profit|compliance|risk|audit|spend)\b/.test(m)) return 'cfo'
  if (/\b(code|deploy|architect|infra|secur|ci|api|database|docker|cloud|stack|bug|repo)\b/.test(m)) return 'cto'
  if (/\b(team|hire|operat|workflow|process|logistics|resource|schedul|meeting|staff|onboard)\b/.test(m)) return 'coo'
  return 'general'
}

export function AgentThinkingAnimation({ domain }: { domain: AgentDomain }) {
  const Animation = DOMAIN_MAP[domain]
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: C.bg,
        border: `1px solid ${C.dim}`,
        borderRadius: 16,
        padding: '10px 16px',
      }}
    >
      <Animation />
    </div>
  )
}
