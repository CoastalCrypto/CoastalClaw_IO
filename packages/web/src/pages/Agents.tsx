import { useState, useEffect } from 'react'
import { AgentCard } from '../components/AgentCard'
import { AgentEditor } from '../components/AgentEditor'

interface Agent {
  id: string; name: string; role: string; tools: string[]; builtIn: boolean; active: boolean
}

const BASE = `http://localhost:${import.meta.env.VITE_CORE_PORT ?? 4747}`

export function Agents({ onNav }: { onNav: (page: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Agent | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    // Note: uses internal session headers logic if needed. However we use fetch raw here as per plan
    const res = await fetch(`${BASE}/api/admin/agents`, { headers: { 'x-admin-token': sessionStorage.getItem('cc_admin_session') ?? '' } })
    if (res.ok) setAgents(await res.json())
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: { name: string; role: string; soul: string; tools: string[] }) => {
    if (editing) {
      await fetch(`${BASE}/api/admin/agents/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': sessionStorage.getItem('cc_admin_session') ?? '' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch(`${BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': sessionStorage.getItem('cc_admin_session') ?? '' },
        body: JSON.stringify(data),
      })
    }
    setEditing(null)
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await fetch(`${BASE}/api/admin/agents/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': sessionStorage.getItem('cc_admin_session') ?? '' },
    })
    load()
  }

  return (
    <div className="min-h-screen text-white bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-fixed">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-[#0d1117]/80 backdrop-blur-sm -z-10" />

      <nav className="fixed top-0 left-0 right-0 z-10 glass-panel border-b-0 rounded-none px-6 py-3 flex justify-between items-center shadow-md">
        <span className="text-sm font-mono tracking-wider" style={{ color: 'var(--color-console-cyan)' }}>{'>'} EXECUTIVE_OS [AGENTS]</span>
        <div className="flex gap-6 font-mono text-sm">
          <button onClick={() => onNav('chat')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/chat</button>
          <button onClick={() => onNav('models')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/models</button>
          <button className="text-cyan-400 font-bold tracking-widest bg-cyan-950/30 px-3 py-1 rounded border border-cyan-800/50">/agents</button>
        </div>
      </nav>

      <div className="pt-20 px-6 max-w-4xl mx-auto">
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
