import { useState } from 'react'
import { WizardStep } from '../components/WizardStep'
import { useOnboarding } from '../store/onboarding'
import { coreClient } from '../api/client'

const PERSONALITY_PRESETS = [
  { id: 'direct', label: 'Direct', desc: 'Concise, data-first, no filler.' },
  { id: 'collaborative', label: 'Collaborative', desc: 'Warm, asks clarifying questions, thinks out loud.' },
  { id: 'analytical', label: 'Analytical', desc: 'Structured, cites sources, hedges uncertainty explicitly.' },
  { id: 'custom', label: 'Custom', desc: 'Write your own personality.' },
]

const PERSONALITY_TEXT: Record<string, string> = {
  direct: 'Direct and concise. Lead with the answer. No filler, no preamble.',
  collaborative: 'Warm and collaborative. Ask one clarifying question when the request is ambiguous. Think out loud when reasoning through complex problems.',
  analytical: 'Analytical and precise. Cite sources. State uncertainty explicitly. Structure responses with headers and bullet points.',
}

export function Onboarding({ onComplete }: { onComplete: (sessionId: string) => void }) {
  const { step, data, update, next, back } = useOnboarding()
  const [personalityPreset, setPersonalityPreset] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const btn = 'w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors mt-6 disabled:opacity-40'
  const input = 'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500'
  const backBtn = 'flex-1 py-3 px-6 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-500 transition-colors'
  const nextBtn = 'flex-1 py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-40'

  const handlePersonalityPreset = (id: string) => {
    setPersonalityPreset(id)
    if (id !== 'custom') update({ personality: PERSONALITY_TEXT[id] ?? '' })
    else update({ personality: '' })
  }

  const handleLaunch = async () => {
    setSubmitting(true)
    setError('')
    try {
      await coreClient.setPersona({
        agentName: data.agentName || 'Assistant',
        agentRole: data.agentRole || 'AI Assistant',
        personality: data.personality || 'Helpful, concise, and honest.',
        orgName: data.orgName || 'Your Organization',
        orgContext: data.orgContext,
        ownerName: data.ownerName,
      })
      onComplete(`session-${Date.now()}`)
    } catch (e) {
      setError('Could not connect to the server. Is coastal-server running?')
      setSubmitting(false)
    }
  }

  if (step === 1)
    return (
      <WizardStep title="Welcome to CoastalClaw" step={1} totalSteps={4}>
        <p className="text-gray-400 mb-6 leading-relaxed">
          Your private AI team, running on your hardware. Set up takes about 2 minutes.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          You'll name your agent, describe your organization, and choose a personality.
          You can change everything later from Settings.
        </p>
        <button className={btn} onClick={next}>Get Started →</button>
      </WizardStep>
    )

  if (step === 2)
    return (
      <WizardStep title="Your organization" step={2} totalSteps={4}>
        <label className="block text-sm text-gray-400 mb-2">Organization name</label>
        <input
          className={input}
          value={data.orgName}
          onChange={(e) => update({ orgName: e.target.value })}
          placeholder="Acme Corp"
          autoFocus
        />
        <label className="block text-sm text-gray-400 mb-2 mt-4">What does your org do? <span className="text-gray-600">(optional — helps agents give better answers)</span></label>
        <textarea
          className={`${input} h-24 resize-none`}
          value={data.orgContext}
          onChange={(e) => update({ orgContext: e.target.value })}
          placeholder="e.g. We run a 50-person SaaS company selling analytics software to mid-market retailers..."
        />
        <label className="block text-sm text-gray-400 mb-2 mt-4">Your name <span className="text-gray-600">(optional — agents use this to address you)</span></label>
        <input
          className={input}
          value={data.ownerName}
          onChange={(e) => update({ ownerName: e.target.value })}
          placeholder="Tony"
        />
        <div className="flex gap-3 mt-6">
          <button className={backBtn} onClick={back}>Back</button>
          <button className={nextBtn} onClick={next} disabled={!data.orgName}>Next →</button>
        </div>
      </WizardStep>
    )

  if (step === 3)
    return (
      <WizardStep title="Name your agent" step={3} totalSteps={4}>
        <label className="block text-sm text-gray-400 mb-2">Agent name</label>
        <input
          className={input}
          value={data.agentName}
          onChange={(e) => update({ agentName: e.target.value })}
          placeholder="JARVIS, Alex, Friday, Max..."
          autoFocus
        />
        <p className="text-xs text-gray-600 mt-2">This is what your primary assistant calls itself.</p>

        <label className="block text-sm text-gray-400 mb-2 mt-4">Role <span className="text-gray-600">(optional)</span></label>
        <input
          className={input}
          value={data.agentRole ?? ''}
          onChange={(e) => update({ agentRole: e.target.value })}
          placeholder="Chief of Staff, Research Assistant, Operations Lead..."
        />

        <div className="mt-6">
          <label className="block text-sm text-gray-400 mb-3">Personality</label>
          <div className="space-y-2">
            {PERSONALITY_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePersonalityPreset(p.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  personalityPreset === p.id
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span className="font-semibold text-sm">{p.label}</span>
                <span className="text-xs ml-2 opacity-60">{p.desc}</span>
              </button>
            ))}
          </div>
          {personalityPreset === 'custom' && (
            <textarea
              className={`${input} h-24 resize-none mt-3`}
              value={data.personality}
              onChange={(e) => update({ personality: e.target.value })}
              placeholder="Describe the personality in plain English..."
              autoFocus
            />
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button className={backBtn} onClick={back}>Back</button>
          <button
            className={nextBtn}
            onClick={next}
            disabled={!data.agentName || !personalityPreset || (personalityPreset === 'custom' && !data.personality)}
          >
            Next →
          </button>
        </div>
      </WizardStep>
    )

  return (
    <WizardStep title="Ready to launch" step={4} totalSteps={4}>
      <div className="space-y-3 mb-6">
        <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
          <span className="text-xs text-gray-500 block">Agent</span>
          <span className="text-white font-semibold">{data.agentName || 'Assistant'}</span>
          <span className="text-gray-500 text-sm ml-2">· {data.personality.slice(0, 50)}{data.personality.length > 50 ? '...' : ''}</span>
        </div>
        <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
          <span className="text-xs text-gray-500 block">Organization</span>
          <span className="text-white font-semibold">{data.orgName || 'Your Organization'}</span>
          {data.ownerName && <span className="text-gray-500 text-sm ml-2">· {data.ownerName}</span>}
        </div>
      </div>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      <div className="flex gap-3">
        <button className={backBtn} onClick={back}>Back</button>
        <button className={nextBtn + ' mt-0'} onClick={handleLaunch} disabled={submitting}>
          {submitting ? 'Launching...' : 'Launch →'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-4 text-center">You can change all of this later in Settings.</p>
    </WizardStep>
  )
}
