import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WizardStep } from './WizardStep'

describe('WizardStep', () => {
  it('renders title and children', () => {
    render(
      <WizardStep title="Company Info" step={2} totalSteps={5}>
        <p>Enter your company name</p>
      </WizardStep>
    )
    expect(screen.getByText('Company Info')).toBeInTheDocument()
    expect(screen.getByText('Enter your company name')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
  })
})
