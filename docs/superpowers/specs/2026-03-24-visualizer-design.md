# Visualizer Design — Neural Ball + Wave

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Coastal Claw a signature visual identity in the chat interface — a user-selectable animated visualizer that reacts in real time to agent state. Two modes: a JARVIS-style neural net ball and a rolling ocean wave (ocean or bioluminescent sub-options). The wave rolls left-to-right when the agent speaks, building and crashing as it replies.

**Architecture:** A shared `VisualizerState` React context drives both visualizer components from WebSocket message events already flowing through the app. Three.js renders both modes inside a `<canvas>` element. User preference is persisted to `localStorage` — no backend required. Onboarding Step 4 becomes the visual selector before launch.

**Tech Stack:** Three.js (3D/WebGL rendering), React context (state machine), `localStorage` (preference persistence), existing WebSocket channel (agent state events), Tailwind v4 (UI chrome around the canvas).

---

## 1. State Machine

Both visualizers share one state machine driven by WebSocket events:

| State | Trigger | Description |
|-------|---------|-------------|
| `idle` | App loaded, no active message | Calm, low-energy ambient animation |
| `thinking` | User message sent, awaiting reply | Energy builds — agent is processing |
| `speaking` | First token of reply received | Full animation — agent is responding |
| `done` | Reply complete | Decays back to `idle` over 1.5s |

`VisualizerState` context exposes `{ state, setState }`. `Chat.tsx` calls `setState` on send, on first reply token, and on completion.

---

## 2. Wave Visualizer

### 2.1 Wave Behavior by State

| State | Amplitude | Speed | Direction | Visual |
|-------|-----------|-------|-----------|--------|
| `idle` | 0.2 | Slow | Gentle left-to-right drift | Calm surface |
| `thinking` | 0.2 → 0.6 (builds) | Increasing | Churning, non-directional | Waves building, particles stirring |
| `speaking` | 0.8 – 1.0 | Fast | Left to right, rolling crash | Foam/glow bursts at crest |
| `done` | Decays to 0.2 | Slows | Settles | 1.5s ease-out back to idle |

### 2.2 Wave Implementation

Three overlapping sine waves with different frequencies and phase offsets compose the wave shape:

```
y(x, t) = A₁·sin(k₁x - ω₁t + φ₁)
         + A₂·sin(k₂x - ω₂t + φ₂)
         + A₃·sin(k₃x - ω₃t + φ₃)
```

Each sine's amplitude (`A`) and angular frequency (`ω`) are driven by the current state. A particle system (100–300 points) clusters near the crest — particles scatter on crash and drift back.

### 2.3 Ocean Sub-option

| Element | Value |
|---------|-------|
| Background | `#0a1628` (deep navy) |
| Wave body | Teal gradient: `#0d4f6b` → `#1a6b8a` |
| Foam crests | `#e8f4f8` (white-blue) |
| Spray particles | White, high opacity, scatter on crash |
| Ambient | Subtle starfield in background |

### 2.4 Bioluminescent Sub-option

| Element | Value |
|---------|-------|
| Background | `#050a0f` (near-black) |
| Wave body | Dark teal base with `#00b4d8` glow, 0.3 base opacity |
| Crest glow | Electric cyan `#00ffff` — intensity scales with amplitude |
| Light particles | Scattered cyan dots (bioluminescent plankton) — brighter near crest |
| Ambient | Slow particle drift when idle, bloom effect at peak speaking |

The bioluminescent palette matches the existing Tailwind cyan-400/cyan-500 (`#22d3ee` / `#06b6d4`) used throughout the app.

---

## 3. Neural Ball (JARVIS mode)

Floating sphere composed of interconnected nodes and edges. Node count and edge brightness scale with agent state — minimal and slow at `idle`, fully lit and pulsing at `speaking`. Rendered in Three.js with the same `VisualizerState` driving animation parameters.

Visual spec for the ball is intentionally brief here — detailed design deferred to Phase 2 implementation when the visual direction for the ball is finalized alongside the wave.

---

## 4. File Structure

```
packages/web/src/components/visualizer/
  VisualizerState.tsx      — React context: state machine + setState
  VisualizerCanvas.tsx     — <canvas> wrapper, mounts selected Three.js scene
  WaveVisualizer.tsx       — Wave scene controller (reads VisualizerState)
  WaveOcean.tsx            — Ocean color scheme + particle style
  WaveBioluminescent.tsx   — Bioluminescent color scheme + particle style
  NeuralBall.tsx           — JARVIS ball scene (Phase 2 detail)
  VisualizerSelector.tsx   — Toggle UI: Ball | Wave › Ocean | Bioluminescent
```

---

## 5. Preference Storage

`localStorage` key: `cc_visualizer_mode`
Values: `'ball'` | `'wave-ocean'` | `'wave-bioluminescent'`
Default: `'wave-bioluminescent'`

No backend persistence needed. The preference loads instantly on app mount before first render.

---

## 6. Onboarding Integration

Onboarding Step 4 ("Choose your first agent") becomes **Step 4: "Choose your experience"**:

- Three large cards side by side:
  - **Neural Ball** — "JARVIS-style AI visualization"
  - **Ocean Wave** — "Dynamic coastal wave"
  - **Bioluminescent Wave** — "Glowing deep-ocean wave"
- Selecting a card previews the animation live (small looping preview in the card)
- Selection stored to `localStorage` immediately; carried into the chat view

The existing `useOnboarding` hook gains a `visualizerMode` field in `OnboardingData`.

---

## 7. Chat Integration

`WaveVisualizer` (or `NeuralBall`) renders in a fixed-height band above the message list in `Chat.tsx`:

```tsx
<div className="border-b border-gray-800">
  <VisualizerCanvas height={180} />
</div>
<div className="flex-1 overflow-y-auto px-4 py-6">
  {messages.map(...)}
</div>
```

`Chat.tsx` calls `setState` at three points:
1. `send()` called → `setState('thinking')`
2. First assistant message token received → `setState('speaking')`
3. Reply complete → `setState('done')` (auto-transitions to `idle` after 1.5s)

---

## 8. Testing

- **`VisualizerState`** — unit test state transitions: idle → thinking → speaking → done → idle. Verify 1.5s auto-transition from done to idle.
- **`WaveVisualizer`** — snapshot test that it mounts without error; Three.js renderer mocked in jsdom environment.
- **`VisualizerSelector`** — React Testing Library: selecting each option updates `localStorage` and re-renders with correct mode.
- **Onboarding Step 4** — test that `visualizerMode` field updates in `OnboardingData` on card selection.

---

## 9. Roadmap Placement

Visual feature, no backend dependencies. Can be built in parallel with any Phase. Depends only on the existing React web portal (Phase 1 complete). Suggested as an early Phase 2 task to establish the visual identity before the full agent suite is wired up.
