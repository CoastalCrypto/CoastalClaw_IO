import type { FastifyInstance } from 'fastify'
import type { SkillStore } from '../../skills/store.js'
import type { ModelRouter } from '../../models/router.js'
import type { SkillGapsLog } from '../../agents/skill-gaps.js'

export async function skillRoutes(
  fastify: FastifyInstance,
  opts: { store: SkillStore; router?: ModelRouter; gaps?: SkillGapsLog }
) {
  const { store } = opts

  // Public — chat needs to read skills for autocomplete
  fastify.get('/api/skills', async (_req, reply) => {
    return reply.send(store.list().filter(s => s.enabled))
  })

  fastify.get('/api/admin/skills', async (_req, reply) => {
    return reply.send(store.list())
  })

  // agentskills.io-compatible bulk export (must be before /:id)
  fastify.get('/api/admin/skills/export', async (_req, reply) => {
    return reply.send(store.list().map(s => ({
      name: s.name, description: s.description, prompt: s.prompt, agentId: s.agentId, enabled: s.enabled,
    })))
  })

  // agentskills.io-compatible bulk import (skips existing slugs)
  fastify.post<{ Body: Array<{ name: string; description: string; prompt: string; agentId?: string }> }>(
    '/api/admin/skills/import',
    async (req, reply) => {
      const skills = Array.isArray(req.body) ? req.body : []
      const results = { created: 0, skipped: 0, errors: [] as string[] }
      for (const s of skills) {
        if (!s.name || !s.description || !s.prompt) { results.errors.push(`Missing fields: ${s.name ?? '(unnamed)'}`); continue }
        const slug = s.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        if (!slug) { results.errors.push(`Invalid name: ${s.name}`); continue }
        if (store.getByName(slug)) { results.skipped++; continue }
        try { store.create({ name: slug, description: s.description, prompt: s.prompt, agentId: s.agentId ?? 'general' }); results.created++ }
        catch (e: any) { results.errors.push(e.message) }
      }
      return reply.send(results)
    }
  )

  fastify.get<{ Params: { id: string } }>('/api/admin/skills/:id', async (req, reply) => {
    const skill = store.get(req.params.id)
    if (!skill) return reply.status(404).send({ error: 'Not found' })
    return reply.send(skill)
  })

  fastify.post<{
    Body: { name: string; description: string; prompt: string; agentId?: string }
  }>('/api/admin/skills', async (req, reply) => {
    const { name, description, prompt, agentId = 'general' } = req.body ?? {}
    if (!name || !description || !prompt)
      return reply.status(400).send({ error: 'name, description, and prompt are required' })
    const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!slug) return reply.status(400).send({ error: 'Invalid name' })
    const skill = store.create({ name: slug, description, prompt, agentId })
    return reply.status(201).send(skill)
  })

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ name: string; description: string; prompt: string; agentId: string; enabled: boolean }>
  }>('/api/admin/skills/:id', async (req, reply) => {
    const updated = store.update(req.params.id, req.body)
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/skills/:id', async (req, reply) => {
    store.delete(req.params.id)
    return reply.status(204).send()
  })

  // Skill self-improvement: analyze recent failure gaps and suggest an improved prompt
  fastify.post<{ Params: { id: string }; Body: { model?: string; autoApply?: boolean } }>(
    '/api/admin/skills/:id/improve',
    async (req, reply) => {
      const { router, gaps } = opts
      if (!router || !gaps) return reply.status(503).send({ error: 'Improvement service not available' })
      const skill = store.get(req.params.id)
      if (!skill) return reply.status(404).send({ error: 'Not found' })
      const recentGaps = gaps.listByAgent(skill.agentId).slice(0, 10)
      if (recentGaps.length === 0) return reply.send({ suggestion: null, message: 'No recent failures — skill looks healthy.' })
      const gapSummary = recentGaps.map((g, i) =>
        `${i + 1}. Tool: ${g.toolName}\n   Failure: ${g.failurePattern.slice(0, 200)}`
      ).join('\n\n')
      const prompt = `You are reviewing an AI agent skill to improve it based on recent failures.\n\nCurrent skill:\nName: ${skill.name}\nDescription: ${skill.description}\nPrompt:\n${skill.prompt}\n\nRecent failures (${recentGaps.length}):\n${gapSummary}\n\nSuggest an improved prompt that avoids these failures and keeps the same {{variable}} placeholders. Return ONLY the improved prompt text.`
      try {
        const result = await router.chat(
          [{ role: 'user', content: prompt }],
          req.body?.model ? { model: req.body.model } : undefined
        )
        const suggestion = result.reply?.trim() ?? ''
        if (req.body?.autoApply && suggestion) {
          store.update(skill.id, { prompt: suggestion })
          recentGaps.forEach(g => gaps.markReviewed(g.id))
          return reply.send({ suggestion, applied: true })
        }
        return reply.send({ suggestion, applied: false })
      } catch (e: any) {
        return reply.status(500).send({ error: `LLM error: ${e.message}` })
      }
    }
  )
}
