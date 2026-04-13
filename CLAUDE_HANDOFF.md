# 🌊 Coastal.AI Handoff (Job B: Interface & Interaction)

## Project Context
Coastal.AI is a "Deep Ocean Command Center" AI Agent OS.
- **Visual Identity**: Abyss Canvas (`#050a0f`), Electric Cyan (`#00e5ff`) accents, Space Grotesk (Display) & Inter (Body).
- **Core Tech**: React 19, Vite 6, Tailwind CSS, Fastify Backend.
- **Current State**: Backend is functional with a "Cascade Router" and hardware-aware tiers (Lite/Standard/Apex).

## Your Task: Job B (Interface & Interaction)
Focus on the premium "OS-like" feel and user onboarding.

### 1. The Onboarding GUI (Electron/React)
- Replace the terminal-based `install.sh/ps1` with a sleek Electron installer.
- **Goal**: A "Path to Value" progress bar that handles Node/Ollama detection and model downloading visually.

### 2. Global Command Palette (Ctrl+K)
- Implement a `CommandPalette` component in the Web UI.
- Actions: Jump to Agents, Pipelines, Analytics, or trigger a "Skill" shortcut.

### 3. Visual Pipeline Editor
- Prototype a node-based interface for the `PipelineBuilder`.
- Use a library like `React Flow` to allow users to "wire" agent sequences visually.

### 4. Empty States & CTAs
- Audit the Dashboard, Analytics, and Skills pages.
- Ensure "Ghost Towns" (no data yet) feature high-fidelity CTAs leading to "New Agent" or "Skill Library."

## Design Tokens (CRITICAL)
- **Primary Cyan**: `#00e5ff` (Used for action/signal).
- **Abyss Background**: `#050a0f`.
- **Panel Surface**: `#0d1f33` (80% opacity with 12px blur).
- **Typography**: Space Grotesk 700 for headings, tracking -1.5px.

---
*Gemini CLI is currently handling Job A (Hardware Intelligence & Skill Packs).*
