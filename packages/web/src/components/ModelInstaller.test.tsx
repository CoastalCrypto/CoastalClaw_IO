import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModelInstaller } from './ModelInstaller'

describe('ModelInstaller', () => {
  it('renders HuggingFace input and quant selector', () => {
    render(<ModelInstaller onInstall={vi.fn()} installing={false} progress={null} />)
    expect(screen.getByPlaceholderText(/mistralai\/Codestral/i)).toBeInTheDocument()
    expect(screen.getByText('Fast')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
  })

  it('calls onInstall with modelId and quant when Install clicked', () => {
    const onInstall = vi.fn()
    render(<ModelInstaller onInstall={onInstall} installing={false} progress={null} />)
    fireEvent.change(screen.getByPlaceholderText(/mistralai\/Codestral/i), {
      target: { value: 'owner/mymodel' },
    })
    fireEvent.click(screen.getByText('Install'))
    expect(onInstall).toHaveBeenCalledWith('owner/mymodel', 'Q4_K_M')
  })

  it('disables Install button while installing', () => {
    render(<ModelInstaller onInstall={vi.fn()} installing={true} progress={null} />)
    expect(screen.getByText('Installing...')).toBeDisabled()
  })
})
