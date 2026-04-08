import { useState, useEffect } from 'react'
import { AgentCard } from '../components/AgentCard'
import { AgentEditor } from '../components/AgentEditor'
import { NavBar, type NavPage } from '../components/NavBar'

interface Agent {
  id: string; name: string; role: string; tools: string[]; builtIn: boolean; active: boolean
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

  const handleSave = async (data: { name: string; role: string; soul: string; tools: string[] }) => {
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

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>
      <NavBar page="agents" onNav={onNav} />

      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 animate-slide-up">
          <h1 className="text-2xl font-mono tracking-wide flex items-center gap-3">
            <span className="w-2 h-6 bg-cyan-500 inline-block"></span> Workforce Matrix
          </h1>
          {!adding && !editing && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 bg-cyan-500/10 border border-cyan-500 hover:bg-cyan-500/30 text-cyan-400 font-mono rounded-md text-sm transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.4)]"
            >
              [+ INITIALIZE_AGENT]
            </button>
          )}
        </div>

        {(adding || editing) && (
          <div className="glass-panel p-6 mb-8 animate-fade-in console-border relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
            <h2 className="text-sm font-mono mb-6 flex items-center gap-2 text-cyan-400">
              <span className="animate-pulse">_</span> {editing ? 'RECONFIGURE_AGENT' : 'NEW_AGENT_PROTOCOL'}
            </h2>
            <AgentEditor
              initial={editing ? { ...editing, soul: '' } : undefined}
              onSave={handleSave}
              onCancel={() => { setAdding(false); setEditing(null) }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={a => { setEditing(a); setAdding(false) }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
