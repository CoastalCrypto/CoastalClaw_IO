import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DomainAssigner } from './DomainAssigner'

const models = [
  { baseName: 'model-a', hfSource: '', variants: [{ id: 'model-a-q4', quantLevel: 'Q4_K_M', sizeGb: 2, addedAt: 0, active: true }] },
  { baseName: 'model-b', hfSource: '', variants: [{ id: 'model-b-q8', quantLevel: 'Q8_0', sizeGb: 8, addedAt: 0, active: true }] },
]

const agents = [
  { id: 'coo', name: 'Chief Operating Officer', role: 'Operations', builtIn: true, active: true },
  { id: 'cfo', name: 'Chief Financial Officer', role: 'Finance', builtIn: true, active: true },
  { id: 'my-agent', name: 'My Custom Agent', role: 'Research', builtIn: false, active: true },
]

describe('DomainAssigner', () => {
  it('renders a row per agent', () => {
    render(<DomainAssigner agents={agents} models={models} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText('Chief Operating Officer')).toBeInTheDocument()
    expect(screen.getByText('Chief Financial Officer')).toBeInTheDocument()
    expect(screen.getByText('My Custom Agent')).toBeInTheDocument()
  })

  it('marks custom agents with "custom" label', () => {
    render(<DomainAssigner agents={agents} models={models} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText('custom')).toBeInTheDocument()
  })

  it('calls onChange when a select changes', async () => {
    const onChange = vi.fn()
    render(<DomainAssigner agents={agents} models={models} registry={{}} onChange={onChange} />)
    const selects = screen.getAllByRole('combobox')
    await act(async () => {
      fireEvent.change(selects[0], { target: { value: 'model-a-q4' } })
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows empty state when no agents', () => {
    render(<DomainAssigner agents={[]} models={models} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText(/No agents found/)).toBeInTheDocument()
  })

  it('shows empty state when no models', () => {
    render(<DomainAssigner agents={agents} models={[]} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText(/Install a model first/)).toBeInTheDocument()
  })
})
