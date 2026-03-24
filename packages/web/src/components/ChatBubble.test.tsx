import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatBubble } from './ChatBubble'

describe('ChatBubble', () => {
  it('renders user message aligned right', () => {
    const { container } = render(<ChatBubble role="user" content="Hello agent" />)
    expect(screen.getByText('Hello agent')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('justify-end')
  })

  it('renders assistant message aligned left', () => {
    const { container } = render(<ChatBubble role="assistant" content="Hello human" />)
    expect(screen.getByText('Hello human')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('justify-start')
  })
})
