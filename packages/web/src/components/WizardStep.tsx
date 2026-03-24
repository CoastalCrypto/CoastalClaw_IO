interface WizardStepProps {
  title: string
  step: number
  totalSteps: number
  children: React.ReactNode
}

export function WizardStep({ title, step, totalSteps, children }: WizardStepProps) {
  const progress = (step / totalSteps) * 100

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-cyan-500 tracking-widest uppercase">
            Step {step} of {totalSteps}
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-1">
          <div
            className="bg-cyan-400 h-1 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">{title}</h2>
      <div>{children}</div>
    </div>
  )
}
