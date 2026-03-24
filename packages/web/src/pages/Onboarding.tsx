import { WizardStep } from '../components/WizardStep'
import { useOnboarding } from '../store/onboarding'

const AGENT_OPTIONS = [
  { id: 'coo', label: 'Virtual COO', desc: 'Operations, process, hiring strategy' },
  { id: 'cfo', label: 'Virtual CFO', desc: 'Burn rate, fundraising, financial forecasting' },
  { id: 'cto', label: 'Virtual CTO', desc: 'Tech stack, architecture, hiring' },
]

export function Onboarding({ onComplete }: { onComplete: (sessionId: string) => void }) {
  const { step, data, update, next, back } = useOnboarding()

  const btnClass =
    'w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors mt-6'
  const inputClass =
    'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500'

  if (step === 1)
    return (
      <WizardStep title="Welcome to Coastal Claw" step={1} totalSteps={5}>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Your private AI executive team. Set up takes about 10 minutes.
          Your data never leaves our facility.
        </p>
        <button className={btnClass} onClick={next}>Get Started →</button>
      </WizardStep>
    )

  if (step === 2)
    return (
      <WizardStep title="Tell us about your company" step={2} totalSteps={5}>
        <label className="block text-sm text-gray-400 mb-2">Company name</label>
        <input
          className={inputClass}
          value={data.companyName}
          onChange={(e) => update({ companyName: e.target.value })}
          placeholder="Acme Corp"
        />
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 px-6 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-500 transition-colors" onClick={back}>Back</button>
          <button className="flex-1 py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors" onClick={next} disabled={!data.companyName}>Next →</button>
        </div>
      </WizardStep>
    )

  if (step === 3)
    return (
      <WizardStep title="What are your biggest challenges?" step={3} totalSteps={5}>
        <textarea
          className={`${inputClass} h-32 resize-none`}
          value={data.challenges}
          onChange={(e) => update({ challenges: e.target.value })}
          placeholder="e.g. managing burn rate, scaling the team, technical debt..."
        />
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-500 transition-colors" onClick={back}>Back</button>
          <button className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors" onClick={next} disabled={!data.challenges}>Next →</button>
        </div>
      </WizardStep>
    )

  if (step === 4)
    return (
      <WizardStep title="Choose your first agent" step={4} totalSteps={5}>
        <div className="space-y-3">
          {AGENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update({ focusArea: opt.id as typeof data.focusArea })}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                data.focusArea === opt.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="text-sm opacity-70 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 border border-gray-700 text-gray-400 rounded-lg" onClick={back}>Back</button>
          <button className="flex-1 py-3 bg-cyan-500 text-black font-semibold rounded-lg" onClick={next} disabled={!data.focusArea}>Next →</button>
        </div>
      </WizardStep>
    )

  return (
    <WizardStep title="You're all set" step={5} totalSteps={5}>
      <div className="text-center py-6">
        <div className="text-5xl mb-4">⚡</div>
        <p className="text-gray-400 mb-2">Provisioning your agent environment...</p>
        <p className="text-sm text-cyan-500">{data.companyName} · {data.focusArea?.toUpperCase()}</p>
      </div>
      <button
        className={btnClass}
        onClick={() => onComplete(`session-${Date.now()}`)}
      >
        Launch →
      </button>
    </WizardStep>
  )
}
