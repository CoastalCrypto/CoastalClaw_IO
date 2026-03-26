/**
 * CoastalClaw Promo Video — Remotion
 *
 * Renders a 30-second promotional video as a React component.
 * Remotion uses ffmpeg to export it as MP4.
 *
 * Preview:  pnpm studio          (opens Remotion Studio at localhost:3000)
 * Export:   pnpm render:promo    (outputs out/promo.mp4)
 *
 * Timeline:
 *   0–2s    Logo reveal with glow pulse
 *   2–5s    Tagline types in
 *   5–12s   3 agent cards slide in (COO → CFO → CTO)
 *   12–18s  Architecture flow diagram animates
 *   18–25s  Key stats counter up
 *   25–30s  CTA + logo hold
 */

import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion'

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:    '#050d1a',
  cyan:  '#00e5ff',
  teal:  '#0094c8',
  navy:  '#004e70',
  white: '#e8f6fb',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useFps() {
  return useVideoConfig().fps
}

function fadeIn(frame: number, start: number, duration: number) {
  return interpolate(frame, [start, start + duration], [0, 1], { extrapolateRight: 'clamp' })
}

// ── Scene 1: Logo reveal ──────────────────────────────────────────────────────
function LogoReveal() {
  const frame = useCurrentFrame()
  const fps = useFps()

  const scale = spring({ frame, fps, config: { damping: 10, mass: 0.8 } })
  const glow = interpolate(frame, [0, 30, 60], [0, 20, 8], { extrapolateRight: 'clamp' })
  const opacity = fadeIn(frame, 0, 20)

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity, transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 ${glow}px ${C.cyan})` }}>
        <Img src={staticFile('logo.svg')} style={{ width: 220 }} />
      </div>
    </AbsoluteFill>
  )
}

// ── Scene 2: Tagline type-in ──────────────────────────────────────────────────
const TAGLINE = 'Your private AI executive team.'
const SUB     = 'Running on your hardware. Data never leaves the facility.'

function TaglineScene() {
  const frame = useCurrentFrame()

  const tagChars = Math.floor(interpolate(frame, [0, 45], [0, TAGLINE.length], { extrapolateRight: 'clamp' }))
  const subOpacity = fadeIn(frame, 50, 20)

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 24, padding: 80 }}>
      <div style={{ color: C.white, fontSize: 52, fontFamily: 'sans-serif',
        fontWeight: 700, textAlign: 'center', letterSpacing: -1 }}>
        {TAGLINE.slice(0, tagChars)}
        <span style={{ color: C.cyan, opacity: frame % 30 < 15 ? 1 : 0 }}>|</span>
      </div>
      <div style={{ color: C.teal, fontSize: 22, fontFamily: 'sans-serif',
        textAlign: 'center', opacity: subOpacity, maxWidth: 680, lineHeight: 1.6 }}>
        {SUB}
      </div>
    </AbsoluteFill>
  )
}

// ── Scene 3: Agent cards ──────────────────────────────────────────────────────
const AGENTS = [
  { role: 'COO', label: 'Chief Operating Officer', desc: 'Workflows · Logistics · Team', color: '#0094c8' },
  { role: 'CFO', label: 'Chief Financial Officer',  desc: 'Budget · Forecast · Compliance', color: '#00b4d8' },
  { role: 'CTO', label: 'Chief Technology Officer', desc: 'Architecture · Code · Security',  color: '#00e5ff' },
]

function AgentCard({ role, label, desc, color, enterFrame, fps }:
  typeof AGENTS[0] & { enterFrame: number; fps: number }) {
  const frame = useCurrentFrame()
  const x = spring({ frame: frame - enterFrame, fps, config: { damping: 12 } })
  const opacity = fadeIn(frame, enterFrame, 15)

  return (
    <div style={{
      opacity,
      transform: `translateX(${interpolate(x, [0, 1], [-120, 0])}px)`,
      background: '#0a1628',
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12,
      padding: '24px 32px',
      width: 320,
      boxShadow: `0 0 24px ${color}22`,
    }}>
      <div style={{ color, fontSize: 28, fontWeight: 800, fontFamily: 'monospace' }}>{role}</div>
      <div style={{ color: C.white, fontSize: 14, marginTop: 4, opacity: 0.8 }}>{label}</div>
      <div style={{ color, fontSize: 12, marginTop: 8, opacity: 0.6 }}>{desc}</div>
    </div>
  )
}

function AgentCardsScene() {
  const fps = useFps()
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20 }}>
      {AGENTS.map((a, i) => (
        <AgentCard key={a.role} {...a} enterFrame={i * 25} fps={fps} />
      ))}
    </AbsoluteFill>
  )
}

// ── Scene 4: Stats counter ────────────────────────────────────────────────────
const STATS = [
  { label: 'Setup time',    from: 0,   to: 20,  unit: 'min', suffix: '' },
  { label: 'Cloud cost',    from: 100, to: 0,   unit: '%',   suffix: '' },
  { label: 'Data privacy',  from: 0,   to: 100, unit: '%',   suffix: '' },
]

function StatsScene() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 80 }}>
      {STATS.map((s, i) => {
        const value = Math.round(
          interpolate(frame, [i * 10, i * 10 + 50], [s.from, s.to],
            { extrapolateRight: 'clamp' })
        )
        return (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ color: C.cyan, fontSize: 72, fontWeight: 800, fontFamily: 'monospace' }}>
              {value}{s.unit}
            </div>
            <div style={{ color: C.white, fontSize: 14, opacity: 0.6, marginTop: 8 }}>{s.label}</div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

// ── Scene 5: CTA hold ────────────────────────────────────────────────────────
function CtaScene() {
  const frame = useCurrentFrame()
  const opacity = fadeIn(frame, 0, 25)
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 32, opacity }}>
      <Img src={staticFile('logo.svg')} style={{ width: 180, filter: `drop-shadow(0 0 12px ${C.cyan})` }} />
      <div style={{ color: C.cyan, fontSize: 20, fontFamily: 'monospace',
        letterSpacing: 4, opacity: 0.8 }}>
        PRIVATE AI · ON YOUR HARDWARE
      </div>
      <div style={{ color: C.white, fontSize: 14, opacity: 0.5 }}>
        github.com/CoastalCrypto/CoastalClaw_IO
      </div>
    </AbsoluteFill>
  )
}

// ── Root composition ──────────────────────────────────────────────────────────
export function PromoVideo() {
  const { fps } = useVideoConfig()
  const f = fps  // alias
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence from={0}        durationInFrames={f * 2}>{<LogoReveal />}</Sequence>
      <Sequence from={f * 2}    durationInFrames={f * 3}>{<TaglineScene />}</Sequence>
      <Sequence from={f * 5}    durationInFrames={f * 7}>{<AgentCardsScene />}</Sequence>
      <Sequence from={f * 12}   durationInFrames={f * 6}>{<StatsScene />}</Sequence>
      <Sequence from={f * 18}   durationInFrames={f * 7}>{<CtaScene />}</Sequence>
    </AbsoluteFill>
  )
}
