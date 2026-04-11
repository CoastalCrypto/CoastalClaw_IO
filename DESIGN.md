# Coastal.AI Design System

## 1. Visual Theme & Atmosphere

Coastal.AI is a **Deep Ocean Command Center** — a private AI agent OS that feels like
mission control at the bottom of the sea. Every surface is dark, pressure-sealed, and
alive with electric cyan energy. The canvas is near-black with a deep ocean blue
undertone (`#050a0f`), not flat black — it reads as *depth*, not emptiness.

The single chromatic signal is **Electric Cyan** (`#00e5ff`), used like a sonar ping:
precise, purposeful, and rare enough that every appearance carries meaning. Against the
abyss, it reads as "system active". A secondary **Neon Magenta** (`#d946ef`) appears
only for critical alerts and brand moments — the ocean catching fire.

Typography uses **Space Grotesk** for compressed, techy display headings with negative
tracking, **Inter** for all body and UI text (readable at data-dense scale), and
**JetBrains Mono** for code, terminal output, and config values. This mirrors how a
real command interface separates signal from noise: display = directive, body = context,
mono = machine.

Cards use a subtle glassmorphism treatment — `backdrop-filter: blur(12px)` with
semi-transparent navy surfaces — creating the impression of panels floating in deep
water. Cyan glows and borders pulse as the primary elevation signal.

**Key Characteristics:**
- Abyss canvas (`#050a0f`) with deep navy surfaces (`#0d1f33`) — not cold, blue-tinged depth
- Single chromatic energy: Electric Cyan (`#00e5ff`) as the "system active" signal
- Magenta Surge (`#d946ef`) reserved for critical/brand moments only
- Space Grotesk display with aggressive negative tracking (-1.5px at 56px)
- Inter body + JetBrains Mono terminal — command-center information hierarchy
- Glassmorphic card panels with cyan border glow
- Wave-form aesthetic: subtle sinusoidal gradients in hero sections
- Data-dense layouts — this is a dashboard OS, not a marketing site

---

## 2. Color Palette & Roles

### Primary Surfaces
| Token | Value | Role |
|-------|-------|------|
| `--color-abyss` | `#050a0f` | Page canvas, deepest background |
| `--color-deep` | `#0a1628` | Section backgrounds, sidebar |
| `--color-surface` | `#0d1f33` | Card backgrounds, panels |
| `--color-panel` | `#112240` | Elevated cards, modals |
| `--color-border` | `#1a3a5c` | Standard borders, dividers |
| `--color-border-subtle` | `rgba(0,229,255,0.12)` | Subtle cyan-tinted borders |

### Accent — Cyan (Primary)
| Token | Value | Role |
|-------|-------|------|
| `--cyan` | `#00e5ff` | Primary accent, CTAs, active states |
| `--cyan-glow` | `#00bfea` | Hover variant, slightly muted |
| `--cyan-dim` | `rgba(0,229,255,0.08)` | Subtle background tint |
| `--cyan-border` | `rgba(0,229,255,0.25)` | Glowing card border |
| `--cyan-text` | `#67e8f9` | Inline cyan text, links |

### Accent — Magenta (Surge)
| Token | Value | Role |
|-------|-------|------|
| `--magenta` | `#d946ef` | Critical alerts, brand moments |
| `--magenta-dim` | `rgba(217,70,239,0.12)` | Magenta tint surfaces |
| `--magenta-border` | `rgba(217,70,239,0.3)` | Alert card borders |

### Text
| Token | Value | Role |
|-------|-------|------|
| `--text-primary` | `#e2f4ff` | Primary text — cool off-white, not pure white |
| `--text-secondary` | `#94adc4` | Secondary text, descriptions |
| `--text-muted` | `#4a6a8a` | Muted text, placeholders, timestamps |
| `--text-inverse` | `#050a0f` | Text on cyan backgrounds |

### Semantic
| Token | Value | Role |
|-------|-------|------|
| `--color-success` | `#10b981` | Success states, positive diffs |
| `--color-warning` | `#f59e0b` | Warnings, degraded states |
| `--color-error` | `#ef4444` | Errors, destructive actions |
| `--color-info` | `#3b82f6` | Info callouts, neutral notices |

### Gradient System
- **Cyan Wave**: `linear-gradient(135deg, #00e5ff 0%, #0066cc 100%)` — hero CTAs, primary buttons
- **Ocean Depth**: `linear-gradient(180deg, #0a1628 0%, #050a0f 100%)` — section backgrounds
- **Surge Glow**: `radial-gradient(ellipse at center, rgba(0,229,255,0.15) 0%, transparent 70%)` — hero atmosphere
- **Cyan Glow Effect**: `drop-shadow(0 0 8px rgba(0,229,255,0.6))` — active icons, logo, highlight elements

---

## 3. Typography Rules

### Font Families
- **Display**: `'Space Grotesk'`, fallbacks: `system-ui, -apple-system, Segoe UI, Arial`
- **Body / UI**: `'Inter'`, fallbacks: `system-ui, -apple-system, Helvetica Neue, Arial`
- **Monospace**: `'JetBrains Mono'`, fallbacks: `'SFMono-Regular', Menlo, Monaco, Consolas, 'Courier New'`

### Type Scale

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Space Grotesk | 56px | 700 | 1.05 | -1.5px | Max compression — primary statements |
| Section Heading | Space Grotesk | 40px | 700 | 1.10 | -1.0px | Feature sections |
| Sub-heading | Space Grotesk | 28px | 600 | 1.20 | -0.5px | Card headings, sub-sections |
| Feature Title | Space Grotesk | 20px | 600 | 1.30 | -0.2px | Feature names, panel headers |
| Body Large | Inter | 18px | 400 | 1.55 | 0.1px | Introductions, lead paragraphs |
| Body | Inter | 16px | 400 | 1.60 | 0.1px | Standard text |
| Body Medium | Inter | 16px | 500 | 1.60 | 0.1px | Emphasized body, descriptions |
| Button | Inter | 14px | 600 | 1.00 | 0.3px | Button labels — uppercase optional |
| Caption | Inter | 13px | 400 | 1.45 | 0.1px | Metadata, timestamps |
| Label | Inter | 12px | 500 | 1.33 | 0.5px | Uppercase labels, status badges |
| Micro | Inter | 11px | 500 | 1.27 | 0.8px | Uppercase micro-labels (`text-transform: uppercase`) |
| Code Block | JetBrains Mono | 13px | 400 | 1.70 | normal | Terminal output, code |
| Code Inline | JetBrains Mono | 13px | 400 | 1.33 | normal | Inline code spans |
| Terminal | JetBrains Mono | 14px | 400 | 1.60 | normal | Shell commands, log output |

### Principles
- **Compressed display for authority**: Space Grotesk at -1.5px letter-spacing at 56px creates dense, engineered power blocks. Tracking relaxes progressively with size.
- **Inter for clarity at density**: Dashboard UIs pack information. Inter's geometric precision reads well at 12px–16px without fatigue.
- **Mono as credential**: Whenever content is machine-generated (logs, config, IDs, shell output), JetBrains Mono signals "this came from the system". Credibility through voice.
- **No serif**: This is a command center. Literary warmth would undermine the aesthetic.

---

## 4. Component Stylings

### Buttons

**Primary (Cyan CTA)**
```css
background: linear-gradient(135deg, #00e5ff, #0066cc);
color: #050a0f;
font: 600 14px/1 Inter;
letter-spacing: 0.3px;
padding: 10px 20px;
border-radius: 8px;
border: none;
```
Hover: `filter: brightness(1.1)` + `box-shadow: 0 0 16px rgba(0,229,255,0.4)`

**Secondary (Glass)**
```css
background: rgba(0,229,255,0.08);
color: #00e5ff;
border: 1px solid rgba(0,229,255,0.25);
padding: 10px 20px;
border-radius: 8px;
```
Hover: `background: rgba(0,229,255,0.15)` + border brightens to `rgba(0,229,255,0.5)`

**Ghost**
```css
background: transparent;
color: #94adc4;
border: 1px solid #1a3a5c;
padding: 10px 20px;
border-radius: 8px;
```
Hover: `color: #e2f4ff`, border shifts to `#2a5a8c`

**Destructive**
```css
background: rgba(239,68,68,0.1);
color: #ef4444;
border: 1px solid rgba(239,68,68,0.3);
border-radius: 8px;
```

### Cards & Panels
```css
background: rgba(13,31,51,0.8);
backdrop-filter: blur(12px);
border: 1px solid rgba(0,229,255,0.12);
border-radius: 12px;
box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,229,255,0.06) inset;
```
**Active/Featured card**: border shifts to `rgba(0,229,255,0.35)` with `box-shadow: 0 0 20px rgba(0,229,255,0.15)`

### Input Fields
```css
background: rgba(10,22,40,0.9);
border: 1px solid #1a3a5c;
color: #e2f4ff;
border-radius: 8px;
padding: 10px 14px;
font: 400 15px Inter;
```
Focus: `border-color: #00e5ff` + `box-shadow: 0 0 0 3px rgba(0,229,255,0.15)`

### Status Badges
```css
/* Active */
background: rgba(16,185,129,0.12); color: #10b981; border-radius: 6px; padding: 2px 8px;
/* Warning */
background: rgba(245,158,11,0.12); color: #f59e0b;
/* Error / Critical */
background: rgba(239,68,68,0.12); color: #ef4444;
/* Cyan / Online */
background: rgba(0,229,255,0.1); color: #00e5ff;
/* Neutral */
background: rgba(148,173,196,0.12); color: #94adc4;
```
All badges: `font: 500 12px/1.33 Inter; letter-spacing: 0.5px; text-transform: uppercase`

### Navigation / Sidebar
- Background: `#0a1628`
- Active item: `background: rgba(0,229,255,0.08)`, left border `2px solid #00e5ff`
- Inactive item: `color: #94adc4`, hover shifts to `#e2f4ff`
- Section labels: `11px Inter 500 uppercase letter-spacing: 1px color: #4a6a8a`

### Chat / Message Bubbles
- User message: `background: rgba(0,229,255,0.1); border: 1px solid rgba(0,229,255,0.2); border-radius: 12px 12px 4px 12px`
- Agent message: `background: #112240; border: 1px solid #1a3a5c; border-radius: 12px 12px 12px 4px`
- Agent name label: `font: 600 11px Inter; letter-spacing: 0.8px; text-transform: uppercase; color: #00e5ff`

---

## 5. Layout Principles

### Spacing System (8px base)
```
4px   — micro gaps, icon margins
8px   — component internal padding tight
12px  — component internal padding standard
16px  — section dividers, card padding
24px  — card-to-card gaps
32px  — section internal spacing
48px  — section-to-section gaps
64px  — major section breaks
96px  — hero vertical padding
```

### Grid
- Max content width: `1280px`
- Standard gutter: `24px`
- Sidebar (app layout): `240px` fixed, `1fr` main
- Dashboard cards: `repeat(auto-fill, minmax(320px, 1fr))`
- Hero: centered single column, max `800px` for copy

### Border Radius Scale
| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | `4px` | Badges, inline elements |
| `--radius-md` | `8px` | Buttons, inputs, compact cards |
| `--radius-lg` | `12px` | Cards, panels, modals |
| `--radius-xl` | `16px` | Featured/hero cards |
| `--radius-pill` | `9999px` | Tags, pill badges |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Canvas | No shadow | Page background |
| Flat Card | `border: 1px solid #1a3a5c` | Standard cards |
| Raised Card | `0 4px 24px rgba(0,0,0,0.4)` + cyan inset ring | Elevated panels |
| Modal | `0 20px 60px rgba(0,0,0,0.7)` + `backdrop-filter: blur(20px)` | Modals, overlays |
| Cyan Glow | `0 0 20px rgba(0,229,255,0.2)` | Active elements, focus |
| Focus Ring | `0 0 0 3px rgba(0,229,255,0.15)` | Keyboard focus |

---

## 7. Motion & Interaction

### Transitions
- Color/border: `150ms ease`
- Shadow/glow: `200ms ease`
- Panel open/close: `250ms cubic-bezier(0.4, 0, 0.2, 1)`
- Glow pulse (active agents): `2s ease-in-out infinite alternate` between `rgba(0,229,255,0.2)` and `rgba(0,229,255,0.05)`

### Hover States
- Buttons: brightness lift + glow spread
- Cards: cyan border brightens from `0.12` → `0.35` opacity
- Nav items: text brightens from `#94adc4` → `#e2f4ff`
- Links: `color: #00e5ff`, `text-decoration: underline rgba(0,229,255,0.3)`

### Loading States
- Skeleton: `#0d1f33` base with `#1a3a5c` shimmer sweep
- Spinner: cyan ring `border-top: 2px solid #00e5ff`
- Agent "thinking": pulsing cyan dot, label `color: #00e5ff`

---

## 8. Responsive Breakpoints

| Name | Width | Notes |
|------|-------|-------|
| Mobile | <640px | Sidebar collapses to bottom nav |
| Tablet | 640–1024px | Sidebar becomes collapsible drawer |
| Desktop | 1024–1280px | Full sidebar + content |
| Wide | >1280px | Content max-width capped at 1280px |

---

## 9. Agent Prompt Guide

### Quick Color Reference
```
Page canvas:    #050a0f
Card surface:   #0d1f33
Primary accent: #00e5ff (cyan)
Surge accent:   #d946ef (magenta — use sparingly)
Primary text:   #e2f4ff
Secondary text: #94adc4
Border:         #1a3a5c
Cyan border:    rgba(0,229,255,0.12)
```

### Font Quick Reference
```
Display:   Space Grotesk 700, -1.5px tracking at 56px
Body:      Inter 400, +0.1px tracking
Terminal:  JetBrains Mono 400
```

### Example Component Prompts
- "Hero section: abyss canvas (#050a0f), Space Grotesk 56px 700 letter-spacing -1.5px text #e2f4ff. Surge glow radial gradient behind heading. Cyan gradient CTA button (8px radius, 10px 20px padding)."
- "Dashboard card: glassmorphic (#0d1f33 80% opacity, blur 12px), 1px cyan border at 12% opacity, 12px radius. Agent name in 11px uppercase cyan Inter 500 letter-spacing 0.8px."
- "Status badge: online state — rgba(0,229,255,0.1) bg, #00e5ff text, 12px Inter 500 uppercase 0.5px tracking, 6px radius, 2px 8px padding."

### Do's and Don'ts

**Do:**
- Use `#00e5ff` cyan as the single active/accent signal
- Apply glassmorphism with real `backdrop-filter: blur(12px)` on cards
- Use Space Grotesk with negative tracking at display sizes
- Use JetBrains Mono for any machine-generated output (logs, IDs, shell)
- Keep magenta rare — one use per screen maximum

**Don't:**
- Don't use pure white (`#ffffff`) for backgrounds — use `#0d1f33` or deeper
- Don't use warm color tones (orange, gold, beige) — the ocean is cold
- Don't use sans-serif body fonts at light (300) weight — density requires 400+
- Don't add cyan glow to more than 2–3 elements per screen
- Don't use pill-shaped buttons for primary CTAs — 8px radius only
