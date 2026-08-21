// Phase 8 (8E, extended): course/module/lesson titles had no admin-facing edit path
// at all before this component — this suite proves the click-to-edit/save/cancel
// contract it now provides.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineEditableTitle } from '../InlineEditableTitle'

describe('InlineEditableTitle', () => {
  it('renders the value as read-only text until the pencil is clicked', () => {
    render(<InlineEditableTitle value="Module 1" onSave={vi.fn()} />)
    expect(screen.getByText('Module 1')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('clicking the edit button swaps in an input pre-filled with the current value', async () => {
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={vi.fn()} editLabel="Edit module title" />)
    await user.click(screen.getByRole('button', { name: 'Edit module title' }))
    expect(screen.getByRole('textbox')).toHaveValue('Module 1')
  })

  it('saves the new value on blur', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={onSave} editLabel="Edit" />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Module 1 renamed')
    await user.tab() // blur
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Module 1 renamed'))
  })

  it('saves the new value on Enter without requiring a separate blur', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={onSave} editLabel="Edit" />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Renamed via Enter{Enter}')
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Renamed via Enter'))
  })

  it('Escape reverts to the original value without saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={onSave} editLabel="Edit" />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Should not be saved')
    await user.keyboard('{Escape}')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Module 1')).toBeInTheDocument()
  })

  it('does not save an empty title — reverts instead', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={onSave} editLabel="Edit" />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Module 1')).toBeInTheDocument()
  })

  it('shows an error and stays in edit mode when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    render(<InlineEditableTitle value="Module 1" onSave={onSave} editLabel="Edit" />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Will fail{Enter}')
    expect(await screen.findByText(/not saved/i)).toBeInTheDocument()
    // Still in edit mode — the admin's typed change isn't silently discarded.
    expect(screen.getByRole('textbox')).toHaveValue('Will fail')
  })

  it('hideText mode renders no duplicate text, only the edit trigger', () => {
    render(<InlineEditableTitle value="Course title" onSave={vi.fn()} hideText editLabel="Edit course title" />)
    expect(screen.queryByText('Course title')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit course title' })).toBeInTheDocument()
  })
})
