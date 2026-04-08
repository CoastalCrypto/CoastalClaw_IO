import { useState, useEffect, useCallback } from 'react'
import { adminClient, type OllamaModel } from '../api/client'

interface PullProgress {
  status?: string
  completed?: number
  total?: number
}

interface Props {
  onModelsChanged: () => void
}

export function OllamaSection({ onModelsChanged }: Props) {
  const [localModels, setLocalModels]   = useState<OllamaModel[]>([])
  const [loading, setLoading]           = useState(true)
  const [pullName, setPullName]         = useState('')
  const [pulling, setPulling]           = useState(false)
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null)
  const [pullError, setPullError]       = useState<string | null>(null)
  const [pullDone, setPullDone]         = useState(false)
  const [importingId, setImportingId]   = useState<string | null>(null)
  const [syncMsg, setSyncMsg]           = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const models = await adminClient.listOllamaModels()
      setLocalModels(models)
    } catch {
      setLocalModels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleImport = async (name: string) => {
    setImportingId(name)
    try {
      await adminClient.importOllamaModel(name)
      await refresh()
      onModelsChanged()
    } finally {
      setImportingId(null)
    }
  }

  const handleSyncAll = async () => {
    try {
      const { synced } = await adminClient.syncOllamaModels()
      setSyncMsg(`Imported ${synced} model${synced !== 1 ? 's' : ''}`)
      await refresh()
      onModelsChanged()
      setTimeout(() => setSyncMsg(null), 3000)
    } catch (e: any) {
      setSyncMsg(e.message)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = pullName.trim()
    if (!name) return
    setPulling(true)
    setPullError(null)
    setPullProgress(null)
    setPullDone(false)

    const sessionId = crypto.randomUUID()
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsPort = import.meta.env.VITE_CORE_PORT ?? '4747'
    const ws = new WebSocket(`${wsProtocol}//${window.location.hostname}:${wsPort}/ws/session`)

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.name !== name) return
        if (msg.type === 'ollama_pull_progress') {
          setPullProgress({ status: msg.status, completed: msg.completed, total: msg.total })
        } else if (msg.type === 'ollama_pull_done') {
          setPullDone(true)
          setPulling(false)
          setPullName('')
          refresh().then(onModelsChanged)
          ws.close()
        } else if (msg.type === 'ollama_pull_error') {
          setPullError(msg.error ?? 'Pull failed')
          setPulling(false)
          ws.close()
        }
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
      await adminClient.pullOllamaModel(name, sessionId)
    } catch (err: any) {
      setPullError(err.message)
      setPulling(false)
      ws.close()
    }
  }

  const pullPercent = pullProgress?.total
    ? Math.round(((pullProgress.completed ?? 0) / pullProgress.total) * 100)
    : null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">Ollama Models</span>
          <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">local</span>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-xs text-cyan-400 font-mono">{syncMsg}</span>}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            title="Rescan Ollama"
          >
            {loading ? 'scanning…' : 'Rescan'}
          </button>
          {localModels.some(m => !m.imported) && (
            <button
              onClick={handleSyncAll}
              className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-1 rounded-lg transition-colors"
            >
              Import all
            </button>
          )}
        </div>
      </div>

      {/* Local model list */}
      {loading ? (
        <p className="text-gray-500 text-sm animate-pulse">Scanning Ollama…</p>
      ) : localModels.length === 0 ? (
        <p className="text-gray-500 text-sm">No models found in Ollama. Pull one below.</p>
      ) : (
        <div className="space-y-2">
          {localModels.map(m => (
            <div key={m.name}
              className="flex items-center justify-between rounded-lg bg-gray-800/60 px-4 py-2.5"
            >
              <div>
                <span className="text-sm text-white font-mono">{m.name}</span>
                <span className="ml-2 text-xs text-gray-500">{m.sizeGb} GB</span>
              </div>
              {m.imported ? (
                <span className="text-xs text-green-400 font-mono">imported</span>
              ) : (
                <button
                  onClick={() => handleImport(m.name)}
                  disabled={importingId === m.name}
                  className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                >
                  {importingId === m.name ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pull new model */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-400 mb-3">
          Pull a model from the Ollama library (e.g. <span className="font-mono text-gray-300">llama3.2</span>,{' '}
          <span className="font-mono text-gray-300">mistral</span>,{' '}
          <span className="font-mono text-gray-300">codellama:13b</span>)
        </p>
        <form onSubmit={handlePull} className="flex gap-2">
          <input
            value={pullName}
            onChange={e => setPullName(e.target.value)}
            placeholder="model name or name:tag"
            disabled={pulling}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!pullName.trim() || pulling}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        </form>

        {/* Progress */}
        {pulling && pullProgress && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-400 font-mono">
              <span>{pullProgress.status ?? 'downloading'}</span>
              {pullPercent !== null && <span>{pullPercent}%</span>}
            </div>
            {pullPercent !== null && (
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-200"
                  style={{ width: `${pullPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {pulling && !pullProgress && (
          <p className="mt-2 text-xs text-gray-400 animate-pulse font-mono">Connecting to Ollama…</p>
        )}

        {pullDone && (
          <p className="mt-2 text-xs text-green-400 font-mono">Pull complete — model imported.</p>
        )}

        {pullError && (
          <p className="mt-2 text-xs text-red-400 font-mono">{pullError}</p>
        )}
      </div>
    </div>
  )
}
