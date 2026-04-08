import { useState, useEffect, useCallback } from 'react'
import { adminClient, type AgentRecord, type ModelGroup, type RegistryUpdate } from '../api/client'
import { ModelCard } from '../components/ModelCard'
import { ModelInstaller } from '../components/ModelInstaller'
import { DomainAssigner } from '../components/DomainAssigner'
import { OllamaSection } from '../components/OllamaSection'

interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

function AdminLoginGate({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await adminClient.login(token.trim())
      onLogin()
    } catch {
      setError('Invalid admin token. Check CC_ADMIN_TOKEN in your core startup output.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm space-y-4">
        <h2 className="text-white font-semibold text-lg">Admin Login</h2>
        <p className="text-gray-400 text-sm">Enter your Coastal Claw admin token to continue.</p>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Admin token"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={!token.trim() || loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  )
}

export function Models() {
  const [authed, setAuthed] = useState(adminClient.isAuthenticated)
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [models, setModels] = useState<ModelGroup[]>([])
  const [registry, setRegistry] = useState<Record<string, Record<string, string>>>({})
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<QuantProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [m, reg, agentList] = await Promise.all([
        adminClient.listModels(),
        adminClient.getRegistry(),
        adminClient.listAgents(),
      ])
      setModels(m)
      setRegistry(reg as Record<string, Record<string, string>>)
      setAgents(agentList)
    } catch (e) {
      console.error('Failed to load models', e)
    }
  }, [])

  useEffect(() => { if (authed) refresh() }, [authed, refresh])

  if (!authed) {
    return <AdminLoginGate onLogin={() => setAuthed(true)} />
  }

  const handleInstall = async (hfModelId: string, quant: string) => {
    setInstalling(true)
    setError(null)
    setProgress(null)
    const sessionId = crypto.randomUUID()

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.hostname
    const wsPort = import.meta.env.VITE_CORE_PORT ?? '4747'
    const ws = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}/ws/session`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'quant_progress') setProgress(msg)
      } catch {}
    }

    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'register', sessionId }))
        resolve()
      } else {
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'register', sessionId }))
          resolve()
        }
      }
    })

    try {
      await adminClient.addModel(hfModelId, [quant], sessionId)
      await new Promise(r => setTimeout(r, 2000))
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Installation failed')
    } finally {
      ws.onmessage = null
      ws.close()
      setInstalling(false)
    }
  }

  const handleRemove = async (variantId: string) => {
    setRemovingId(variantId)
    try {
      await adminClient.removeModel(variantId)
      await refresh()
    } catch (e: unknown) {
      console.error('Remove failed', e)
    } finally {
      setRemovingId(null)
    }
  }

  const handleRegistryChange = async (update: RegistryUpdate) => {
    await adminClient.updateRegistry(update)
    setRegistry(prev => ({ ...prev, ...update }))
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <h1 className="text-xl font-bold text-white mb-6">Model Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {models.length === 0 && (
          <div className="col-span-full text-gray-500 text-sm">
            No models installed yet. Add one below.
          </div>
        )}
        {models.map(g => (
          <ModelCard key={g.baseName} group={g} onRemove={handleRemove} removingId={removingId ?? undefined} />
        ))}
      </div>

      <div className="mb-8">
        <OllamaSection onModelsChanged={refresh} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ModelInstaller
          onInstall={handleInstall}
          installing={installing}
          progress={progress}
          error={error}
        />
        <DomainAssigner
          agents={agents}
          models={models}
          registry={registry}
          onChange={handleRegistryChange}
        />
      </div>
    </div>
  )
}
