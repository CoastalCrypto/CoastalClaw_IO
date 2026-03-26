/**
 * ArchitectureScene — Motion Canvas animated explainer
 *
 * Animates the CoastalClaw routing architecture diagram —
 * ideal for docs, YouTube explainers, or investor decks.
 *
 * Usage:
 *   pnpm mc:dev    → opens Motion Canvas editor at localhost:9000
 *   pnpm mc:build  → exports scene frames for video encoding
 *
 * Scene timeline:
 *   0s   "User message" node fades in
 *   1s   Arrow draws to "Domain Classifier"
 *   2s   COO / CFO / CTO branches fan out
 *   3.5s "VRAM Router" appears with fallback cascade labels
 *   5s   "Ollama" node glows, reply arrow returns to user
 *   6.5s Memory tier labels slide in (LosslessDB + Mem0)
 *   8s   Full diagram holds, logo drops in at bottom
 */

import {
  makeScene2D,
  Circle,
  Rect,
  Line,
  Txt,
  Layout,
} from '@motion-canvas/2d'
import {
  waitFor,
  all,
  createRef,
  easeOutCubic,
  linear,
} from '@motion-canvas/core'

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:    '#050d1a',
  cyan:  '#00e5ff',
  teal:  '#0094c8',
  navy:  '#004e70',
  dim:   '#0d4f6b',
  white: '#e8f6fb',
}

// ── Helper: animated arrow ───────────────────────────────────────────────────
function* drawArrow(line: ReturnType<typeof createRef<Line>>, duration = 0.5) {
  yield* line().end(1, duration, easeOutCubic)
}

export default makeScene2D(function* (view) {
  view.fill(C.bg)

  // ── Node refs ────────────────────────────────────────────────────────────────
  const userNode      = createRef<Rect>()
  const classNode     = createRef<Rect>()
  const cooNode       = createRef<Rect>()
  const cfoNode       = createRef<Rect>()
  const ctoNode       = createRef<Rect>()
  const routerNode    = createRef<Rect>()
  const ollamaNode    = createRef<Circle>()
  const memNode       = createRef<Rect>()
  const arrowUserClass = createRef<Line>()
  const arrowClassRouter = createRef<Line>()
  const arrowRouterOllama = createRef<Line>()
  const arrowOllamaUser  = createRef<Line>()
  const arrowMem         = createRef<Line>()

  const nodeStyle = {
    width: 180, height: 52, radius: 10,
    fill: '#0a1628', stroke: C.teal, lineWidth: 1.5,
    opacity: 0,
  }

  const labelStyle = {
    fontSize: 16, fontFamily: 'monospace', fill: C.white, opacity: 0.9,
  }

  // ── Add all nodes (invisible) ─────────────────────────────────────────────
  view.add(
    <Layout direction="column" alignItems="center" gap={60} y={-80}>

      {/* User */}
      <Rect ref={userNode} {...nodeStyle} stroke={C.cyan}>
        <Txt {...labelStyle} fill={C.cyan}>User Message</Txt>
      </Rect>

      {/* Classifier */}
      <Rect ref={classNode} {...nodeStyle}>
        <Txt {...labelStyle}>Domain Classifier</Txt>
      </Rect>

      {/* Branch row */}
      <Layout direction="row" gap={24}>
        <Rect ref={cooNode} {...nodeStyle} width={120} height={44} stroke={C.navy}>
          <Txt {...labelStyle} fontSize={14} fill={C.teal}>COO</Txt>
        </Rect>
        <Rect ref={cfoNode} {...nodeStyle} width={120} height={44} stroke={C.navy}>
          <Txt {...labelStyle} fontSize={14} fill={C.teal}>CFO</Txt>
        </Rect>
        <Rect ref={ctoNode} {...nodeStyle} width={120} height={44} stroke={C.navy}>
          <Txt {...labelStyle} fontSize={14} fill={C.teal}>CTO</Txt>
        </Rect>
      </Layout>

      {/* VRAM Router */}
      <Rect ref={routerNode} {...nodeStyle} width={220}>
        <Txt {...labelStyle}>VRAM-aware Router</Txt>
      </Rect>

      {/* Ollama */}
      <Circle ref={ollamaNode} size={72} fill={C.navy} stroke={C.cyan}
        lineWidth={2} opacity={0}>
        <Txt fontSize={13} fontFamily="monospace" fill={C.cyan}>Ollama</Txt>
      </Circle>

      {/* Memory */}
      <Rect ref={memNode} {...nodeStyle} width={260} stroke={C.dim}>
        <Txt {...labelStyle} fontSize={13} fill={C.dim} opacity={0.7}>
          LosslessDB → Mem0
        </Txt>
      </Rect>

    </Layout>
  )

  // ── Animation sequence ────────────────────────────────────────────────────

  // 0s — User node fades in
  yield* userNode().opacity(1, 0.5)
  yield* waitFor(0.3)

  // 0.8s — Classifier appears
  yield* classNode().opacity(1, 0.4)
  yield* waitFor(0.2)

  // 1.2s — Branch nodes fan out
  yield* all(
    cooNode().opacity(1, 0.35),
    cfoNode().opacity(1, 0.35),
    ctoNode().opacity(1, 0.35),
  )
  yield* waitFor(0.4)

  // 2s — VRAM router
  yield* routerNode().opacity(1, 0.4)
  yield* waitFor(0.3)

  // 2.7s — Ollama glows in
  yield* ollamaNode().opacity(1, 0.4)
  yield* ollamaNode().stroke(C.cyan, 0.6, linear)
  yield* waitFor(0.5)

  // 3.6s — Memory tier
  yield* memNode().opacity(1, 0.4)
  yield* waitFor(1.5)

  // 5s — Flash the full chain cyan to show data flow
  yield* all(
    userNode().stroke(C.cyan, 0.3),
    classNode().stroke(C.cyan, 0.3),
    routerNode().stroke(C.cyan, 0.3),
  )
  yield* waitFor(0.4)
  yield* all(
    userNode().stroke(C.teal, 0.5),
    classNode().stroke(C.teal, 0.5),
    routerNode().stroke(C.teal, 0.5),
  )

  yield* waitFor(2)
})
