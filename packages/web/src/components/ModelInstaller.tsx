import { useState } from 'react'

interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

type Quant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'

interface ModelInstallerProps {
  onInstall: (hfModelId: string, quant: Quant) => void
  installing: boolean
  progress: QuantProgress | null
  error?: string | null
}

const QUANT_OPTIONS: { value: Quant; label: string; desc: string }[] = [
  { value: 'Q4_K_M', label: 'Fast',     desc: 'Smallest — fits more models in VRAM' },
  { value: 'Q5_K_M', label: 'Balanced', desc: 'Recommended — best quality/size tradeoff' },
  { value: 'Q8_0',   label: 'Quality',  desc: 'Highest quality — requires more VRAM' },
]

export function ModelInstaller({ onInstall, installing, progress, error }: ModelInstallerProps) {
  const [modelId, setModelId] = useState('')
  const [quant, setQuant] = useState<Quant>('Q4_K_M')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Add Model</h3>

      <label className="block text-xs text-gray-400 mb-1">HuggingFace Model ID</label>
      <input
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 mb-4"
        placeholder="mistralai/Codestral-22B-v0.1"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        disabled={installing}
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        {QUANT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setQuant(opt.value)}
            className={`p-3 rounded-lg border text-left transition-all ${
              quant === opt.value
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="text-sm font-semibold text-white">{opt.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>

      {progress && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{progress.message}</span>
            <span>{progress.step}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1">
            <div
              className="bg-cyan-400 h-1 rounded-full transition-all"
              style={{ width: `${(progress.step / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 mb-3">{error}</div>
      )}

      <button
        onClick={() => onInstall(modelId, quant)}
        disabled={!modelId.trim() || installing}
        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-lg transition-colors text-sm"
      >
        {installing ? 'Installing...' : 'Install'}
      </button>
    </div>
  )
}
