import { useState, useEffect } from 'react'
import { AgentCard } from '../components/AgentCard'
import { AgentEditor } from '../components/AgentEditor'
import { NavBar, type NavPage } from '../components/NavBar'

interface Agent {
  id: string; name: string; role: string; tools: string[]; builtIn: boolean; active: boolean; voice?: string
}

function adminHeaders(): Record<string, string> {
  const session = sessionStorage.getItem('cc_admin_session') ?? ''
  return session ? { 'x-admin-session': session } : {}
}

export function Agents({ onNav }: { onNav: (page: NavPage) => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Agent | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/agents', { headers: adminHeaders() })
    if (res.ok) setAgents(await res.json())
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: { name: string; role: string; soul: string; tools: string[]; voice: string }) => {
    if (editing) {
      await fetch(`/api/admin/agents/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(data),
      })
    }
    setEditing(null)
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await fetch(`/api/admin/agents/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    })
    load()
  }

  const handleToggle = async (id: string, active: boolean) => {
    // Optimistic update
    setAgents(prev => prev.map(a => a.id === id ? { ...a, active } : a))
    const res = await fetch(`/api/admin/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) {
      // Revert on failure
      setAgents(prev => prev.map(a => a.id === id ? { ...a, active: !active } : a))
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0A0F1C 0%, #0D1829 60%, #0A0F1C 100%)' }}>
      <NavBar page="agents" onNav={onNav} />

      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 animate-slide-up">
          <div className="flex items-center gap-3">
            <span style={{ color: '#00D4FF', fontSize: '24px', lineHeight: 1 }}>✳</span>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
              AI Agents
            </h1>
          </div>
          {!adding && !editing && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 text-black font-bold rounded-lg text-sm transition-all"
              style={{ background: '#00D4FF', fontFamily: 'Space Grotesk, sans-serif' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#00B8D9'; (e.target as HTMLElement).style.boxShadow = '0 0 20px rgba(0,212,255,0.30)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#00D4FF'; (e.target as HTMLElement).style.boxShadow = 'none' }}
            >
              + New Agent
            </button>
          )}
        </div>

        {(adding || editing) && (
          <div className="mb-8 animate-fade-in rounded-xl overflow-hidden" style={{ background: 'rgba(26,39,68,0.80)', border: '1px solid rgba(0,212,255,0.20)' }}>
            <div className="px-6 py-3 flex items-center gap-2" style={{ background: 'rgba(0,212,255,0.06)', borderBottom: '1px solid rgba(0,212,255,0.12)' }}>
              <span style={{ color: '#00D4FF' }}>✳</span>
              <span className="text-sm font-bold" style={{ color: '#00D4FF', fontFamily: 'Space Grotesk, sans-serif' }}>
                {editing ? 'Edit Agent' : 'New Agent'}
              </span>
            </div>
            <div className="p-6">
              <AgentEditor
                initial={editing ? { ...editing, soul: '', voice: editing.voice ?? '' } : undefined}
                onSave={handleSave}
                onCancel={() => { setAdding(false); setEditing(null) }}
              />
            </div>
          </div>
        )}

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span style={{ fontSize: '48px', color: '#00D4FF', opacity: 0.3 }}>✳</span>
            <p className="mt-4 text-white font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>No agents configured</p>
            <p className="mt-1 text-sm" style={{ color: '#A0AEC0' }}>Create your first agent to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={a => { setEditing(a); setAdding(false) }}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
