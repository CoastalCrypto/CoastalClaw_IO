import { useState } from 'react'

export interface OnboardingData {
  companyName: string
  challenges: string
  focusArea: 'coo' | 'cfo' | 'cto' | ''
  hasPitchDeck: boolean
}

export function useOnboarding() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    challenges: '',
    focusArea: '',
    hasPitchDeck: false,
  })

  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...patch }))

  const next = () => setStep((s) => Math.min(s + 1, 5))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  return { step, data, update, next, back }
}
