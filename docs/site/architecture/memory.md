---
title: Memory System
description: How Coastal.AI remembers context across sessions.
---

# Memory System

Coastal.AI uses a two-tier memory architecture: a lossless short-term store and a compressed long-term store.

## Tier 1: LosslessDB (SQLite)

Every turn in every conversation is written to a SQLite database. This is the source of truth for session history and is used to reconstruct context for the LLM.

- **Storage**: `CC_DATA_DIR/sessions.db`
- **Retention**: All turns, forever (no automatic pruning)
- **Query**: Last N turns retrieved by `sessionId`

## Tier 2: Mem0 (vector store)

Mem0 provides semantic long-term memory. When a session's history grows beyond the active window, older entries are compressed and stored in the vector store for retrieval across sessions.

- **Flush trigger**: Runs fire-and-forget after every `/api/chat` call
- **Window size**: 20 entries (configurable via `flushOldEntries(sessionId, windowSize)`)
- **Format**: `[role]: content` strings passed to `mem0.remember()`

## Memory flush flow

```
POST /api/chat
  │
  ├─ queryHistory(sessionId, limit=20) — fetch active window
  │
  └─ flushOldEntries(sessionId, 20) — fire-and-forget
       │
       ├─ query(sessionId, limit=40) — fetch full history
       │
       ├─ displaced = entries beyond position 20
       │
       └─ for each displaced entry:
            mem0.remember(sessionId, "[role]: content")
              .catch(warn)   // never blocks the response
```

## UnifiedMemory API

```typescript
// Store a new turn
await memory.remember(sessionId, role, content)

// Retrieve recent context for LLM
const history = await memory.queryHistory({ sessionId, limit: 20 })

// Flush overflow to Mem0 (called automatically — no need to call manually)
await memory.flushOldEntries(sessionId, windowSize)
```

## Session IDs

Sessions are identified by a client-provided `sessionId`. The API enforces:

- Pattern: `^[a-zA-Z0-9_-]+$`
- Max length: 128 characters

Use a UUID (`crypto.randomUUID()`) for new sessions. Reuse the same ID to maintain context across page reloads or reconnections.
