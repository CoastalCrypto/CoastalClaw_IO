import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModelCard } from './ModelCard'

const group = {
  baseName: 'codestral:22b',
  hfSource: 'mistralai/Codestral-22B-v0.1',
  variants: [
    { id: 'codestral:22b-Q4_K_M', quantLevel: 'Q4_K_M', sizeGb: 12.5, addedAt: Date.now(), active: true },
    { id: 'codestral:22b-Q8_0',   quantLevel: 'Q8_0',   sizeGb: 23.1, addedAt: Date.now(), active: true },
  ],
}

describe('ModelCard', () => {
  it('renders model name and source', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} />)
    expect(screen.getByText('codestral:22b')).toBeInTheDocument()
    expect(screen.getByText('mistralai/Codestral-22B-v0.1')).toBeInTheDocument()
  })

  it('renders quant variant badges', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} />)
    expect(screen.getByText('Q4_K_M')).toBeInTheDocument()
    expect(screen.getByText('Q8_0')).toBeInTheDocument()
  })

  it('calls onRemove with variant id when Remove clicked', () => {
    const onRemove = vi.fn()
    render(<ModelCard group={group} onRemove={onRemove} />)
    fireEvent.click(screen.getAllByText('Remove')[0])
    expect(onRemove).toHaveBeenCalledWith('codestral:22b-Q4_K_M')
  })

  it('disables Remove button for removing variant while removal is pending', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} removingId="codestral:22b-Q4_K_M" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
    expect(buttons[0]).toHaveTextContent('Removing\u2026')
  })
})
