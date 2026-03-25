import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DomainAssigner } from './DomainAssigner'

const models = [
  { baseName: 'model-a', hfSource: '', variants: [{ id: 'model-a-q4', quantLevel: 'Q4_K_M', sizeGb: 2, addedAt: 0, active: true }] },
  { baseName: 'model-b', hfSource: '', variants: [{ id: 'model-b-q8', quantLevel: 'Q8_0', sizeGb: 8, addedAt: 0, active: true }] },
]

describe('DomainAssigner', () => {
  it('renders 4 domain rows', () => {
    render(<DomainAssigner models={models} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText('COO')).toBeInTheDocument()
    expect(screen.getByText('CFO')).toBeInTheDocument()
    expect(screen.getByText('CTO')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('calls onChange when a select changes', () => {
    const onChange = vi.fn()
    render(<DomainAssigner models={models} registry={{}} onChange={onChange} />)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'model-a-q4' } })
    expect(onChange).toHaveBeenCalled()
  })
})
