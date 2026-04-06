import { useState } from 'react'

export interface OnboardingData {
  orgName: string
  orgContext: string
  ownerName: string
  agentName: string
  personality: string
}

export function useOnboarding() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    orgName: '',
    orgContext: '',
    ownerName: '',
    agentName: '',
    personality: '',
  })

  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...patch }))

  const next = () => setStep((s) => Math.min(s + 1, 5))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  return { step, data, update, next, back }
}
