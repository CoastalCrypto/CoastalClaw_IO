import { useState, useEffect, useCallback } from 'react'
import { CoreClient, type ModelGroup, type RegistryUpdate } from '../api/client'
import { ModelCard } from '../components/ModelCard'
import { ModelInstaller } from '../components/ModelInstaller'
import { DomainAssigner } from '../components/DomainAssigner'

interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

const adminClient = new CoreClient('/api', import.meta.env.VITE_ADMIN_TOKEN ?? '')
if (!import.meta.env.VITE_ADMIN_TOKEN) {
  console.warn('[Models] VITE_ADMIN_TOKEN is not set — admin API calls will return 401. Set it in packages/web/.env.local')
}
// Note: Set VITE_ADMIN_TOKEN in packages/web/.env.local to match CC_ADMIN_TOKEN from core startup output.

export function Models() {
  const [models, setModels] = useState<ModelGroup[]>([])
  const [registry, setRegistry] = useState<Record<string, Record<string, string>>>({})
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<QuantProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [m, reg] = await Promise.all([
        adminClient.listModels(),
        adminClient.getRegistry(),
      ])
      setModels(m)
      setRegistry(reg as Record<string, Record<string, string>>)
    } catch (e) {
      console.error('Failed to load models', e)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleInstall = async (hfModelId: string, quant: string) => {
    setInstalling(true)
    setError(null)
    setProgress(null)
    const sessionId = `install-${Date.now()}`

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

    try {
      await adminClient.addModel(hfModelId, [quant], sessionId)
      await new Promise(r => setTimeout(r, 2000))
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Installation failed')
    } finally {
      ws.onmessage = null  // prevent buffered messages from firing after this point
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ModelInstaller
          onInstall={handleInstall}
          installing={installing}
          progress={progress}
          error={error}
        />
        <DomainAssigner
          models={models}
          registry={registry}
          onChange={handleRegistryChange}
        />
      </div>
    </div>
  )
}
