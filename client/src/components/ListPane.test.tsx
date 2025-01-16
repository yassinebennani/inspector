import { render, screen, fireEvent } from '@testing-library/react'
import ListPane from './ListPane'
import { describe, it, expect, vi } from 'vitest'

describe('ListPane', () => {
  const defaultProps = {
    items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
    listItems: vi.fn(),
    clearItems: vi.fn(),
    setSelectedItem: vi.fn(),
    renderItem: (item: { name: string }) => <span>{item.name}</span>,
    title: 'Test List',
    buttonText: 'List Items'
  }

  it('renders title correctly', () => {
    render(<ListPane {...defaultProps} />)
    expect(screen.getByText('Test List')).toBeInTheDocument()
  })

  it('renders list items using renderItem prop', () => {
    render(<ListPane {...defaultProps} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('calls listItems when List Items button is clicked', () => {
    render(<ListPane {...defaultProps} />)
    fireEvent.click(screen.getByText('List Items'))
    expect(defaultProps.listItems).toHaveBeenCalledTimes(1)
  })

  it('calls clearItems when Clear button is clicked', () => {
    render(<ListPane {...defaultProps} />)
    fireEvent.click(screen.getByText('Clear'))
    expect(defaultProps.clearItems).toHaveBeenCalledTimes(1)
  })

  it('calls setSelectedItem when an item is clicked', () => {
    render(<ListPane {...defaultProps} />)
    fireEvent.click(screen.getByText('Item 1'))
    expect(defaultProps.setSelectedItem).toHaveBeenCalledWith(defaultProps.items[0])
  })

  it('disables Clear button when items array is empty', () => {
    render(<ListPane {...defaultProps} items={[]} />)
    expect(screen.getByText('Clear')).toBeDisabled()
  })

  it('respects isButtonDisabled prop for List Items button', () => {
    render(<ListPane {...defaultProps} isButtonDisabled={true} />)
    expect(screen.getByText('List Items')).toBeDisabled()
  })
})
