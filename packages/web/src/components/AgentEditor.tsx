import { useState, useEffect } from 'react'

const ALL_TOOLS = [
  { name: 'read_file', category: 'File', reversible: true },
  { name: 'write_file', category: 'File', reversible: false },
  { name: 'list_dir', category: 'File', reversible: true },
  { name: 'delete_file', category: 'File', reversible: false },
  { name: 'run_command', category: 'Shell', reversible: false },
  { name: 'git_status', category: 'Git', reversible: true },
  { name: 'git_diff', category: 'Git', reversible: true },
  { name: 'git_commit', category: 'Git', reversible: false },
  { name: 'git_log', category: 'Git', reversible: true },
  { name: 'query_db', category: 'Database', reversible: false },
  { name: 'http_get', category: 'Web', reversible: true },
  { name: 'logic_sequentialthinking', category: 'MCP: Logic', reversible: false },
  { name: 'memory_read_graph', category: 'MCP: Memory', reversible: true },
  { name: 'memory_search_nodes', category: 'MCP: Memory', reversible: true },
  { name: 'memory_open_nodes', category: 'MCP: Memory', reversible: true },
  { name: 'memory_create_entities', category: 'MCP: Memory', reversible: false },
  { name: 'memory_create_relations', category: 'MCP: Memory', reversible: false },
  { name: 'memory_add_observations', category: 'MCP: Memory', reversible: false },
  { name: 'memory_delete_entities', category: 'MCP: Memory', reversible: false },
  { name: 'memory_delete_observations', category: 'MCP: Memory', reversible: false },
  { name: 'memory_delete_relations', category: 'MCP: Memory', reversible: false },
]

interface Props {
  initial?: { name: string; role: string; soul: string; tools: string[]; voice?: string }
  onSave: (data: { name: string; role: string; soul: string; tools: string[]; voice: string }) => Promise<void>
  onCancel: () => void
}

export function AgentEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? '')
  const [soul, setSoul] = useState(initial?.soul ?? '')
  const [tools, setTools] = useState<string[]>(initial?.tools ?? [])
  const [voice, setVoice] = useState(initial?.voice ?? '')
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [saving, setSaving] = useState(false)

  const [vibeVoices, setVibeVoices] = useState<{ id: string; label: string }[]>([])

  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis?.getVoices() ?? []
      if (vs.length) setAvailableVoices(vs.filter(v => v.lang.startsWith('en')))
    }
    load()
    window.speechSynthesis?.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load)
  }, [])

  useEffect(() => {
    fetch('/api/voices')
      .then(r => r.ok ? r.json() : { voices: [] })
      .then(d => { if (d.vibeAvailable) setVibeVoices(d.voices) })
      .catch(() => {})
  }, [])

  const previewVoice = async () => {
    const previewText = `Hi, I'm ${name || 'your agent'}. Ready to assist.`
    if (voice.startsWith('vv:')) {
      const vibeId = voice.slice(3)
      const session = sessionStorage.getItem('cc_admin_session') ?? ''
      const res = await fetch('/api/admin/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { 'x-admin-session': session } : {}) },
        body: JSON.stringify({ text: previewText, voice: vibeId }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      new Audio(URL.createObjectURL(blob)).play()
      return
    }
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(previewText)
    const match = availableVoices.find(v => v.name === voice)
    if (match) u.voice = match
    u.rate = 1.0; u.pitch = 1.0
    window.speechSynthesis.speak(u)
  }

  const toggleTool = (t: string) =>
    setTools(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const tokenEstimate = Math.round(soul.split(/\s+/).length * 1.3)
  const tokenPct = Math.round((tokenEstimate / 1500) * 100)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ name, role, soul, tools, voice }) } finally { setSaving(false) }
  }

  const categories = [...new Set(ALL_TOOLS.map(t => t.category))]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            placeholder="e.g. Legal Officer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Role</label>
          <input
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            placeholder="e.g. Legal & compliance"
          />
        </div>
      </div>

      {/* Voice picker */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Voice</label>
        <div className="flex gap-2">
          <select
            value={voice}
            onChange={e => setVoice(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">— System default —</option>
            {availableVoices.length > 0 && (
              <optgroup label="Browser voices">
                {availableVoices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </optgroup>
            )}
            {vibeVoices.length > 0 && (
              <optgroup label="VibeVoice (AI · on-device)">
                {vibeVoices.map(v => (
                  <option key={v.id} value={`vv:${v.id}`}>{v.label}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            onClick={previewVoice}
            disabled={!voice}
            className="px-3 py-2 text-xs font-mono text-cyan-400 border border-cyan-800/50 rounded-lg hover:border-cyan-500/50 disabled:opacity-30 transition-colors"
            title="Preview voice"
          >
            ▶ preview
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {availableVoices.length === 0
            ? 'No browser voices detected — try refreshing, or use a Chromium-based browser.'
            : `${availableVoices.length} browser voice${availableVoices.length !== 1 ? 's' : ''} available.`
          }
          {vibeVoices.length === 0 && ' VibeVoice (AI) not running.'}
        </p>
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Soul (identity + instructions)</label>
          <span className={`text-xs ${tokenPct > 90 ? 'text-amber-400' : 'text-gray-600'}`}>
            ~{tokenEstimate} / 1500 tokens ({tokenPct}%)
          </span>
        </div>
        <textarea
          value={soul}
          onChange={e => setSoul(e.target.value)}
          rows={10}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 resize-y"
          placeholder="# Agent Name&#10;&#10;You are..."
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Tool permissions</label>
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat}>
              <div className="text-xs text-gray-600 mb-1">{cat}</div>
              <div className="flex flex-wrap gap-2">
                {ALL_TOOLS.filter(t => t.category === cat).map(t => (
                  <label key={t.name} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tools.includes(t.name)}
                      onChange={() => toggleTool(t.name)}
                      className="accent-cyan-500"
                    />
                    <span className="text-xs text-gray-300">{t.name}</span>
                    {!t.reversible && (
                      <span className="text-xs text-amber-600">⚠</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !name || !role}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Agent'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
