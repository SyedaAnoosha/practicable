// "Failure text says which failure it is — no token,
// asset not ready, asset id unknown to Mux, player script failed to load." Four
// distinct messages, previously one generic "Failed to load video player" covering
// all of them (and no-token/not-ready/unknown-asset weren't detected at all).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoPreview } from '../VideoPreview'

// The real component dynamically imports @mux/mux-player-react — stub it so tests
// don't depend on the actual player library loading.
vi.mock('@mux/mux-player-react', () => ({
  default: (props: { playbackId?: string }) => <div data-testid="mux-player">{props.playbackId}</div>,
}))

describe('VideoPreview', () => {
  it('shows a distinct message when no playback id exists at all', () => {
    render(<VideoPreview noPlaybackId />)
    expect(screen.getByText(/no video attached/i)).toBeInTheDocument()
  })

  it('shows a distinct message when the token/status request itself failed', () => {
    render(<VideoPreview playbackId="pb_1" tokenError />)
    expect(screen.getByText(/could not check this video with mux/i)).toBeInTheDocument()
  })

  it('shows the encoding state with a spinner, not an error', () => {
    render(<VideoPreview playbackId="pb_1" state="encoding" />)
    expect(screen.getByText(/still encoding/i)).toBeInTheDocument()
  })

  it('shows a distinct message for a Mux-side encoding failure', () => {
    render(<VideoPreview playbackId="pb_1" state="asset_error" />)
    expect(screen.getByText(/couldn't encode this video/i)).toBeInTheDocument()
  })

  it('shows a distinct message when Mux does not recognize the asset', () => {
    render(<VideoPreview playbackId="pb_1" state="asset_unknown" />)
    expect(screen.getByText(/doesn't recognize this video/i)).toBeInTheDocument()
  })

  it('renders the player once state is ready and a token is present', async () => {
    render(<VideoPreview playbackId="pb_1" playbackToken="tok_1" state="ready" />)
    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })

  it('does not render the player if a token has not arrived yet, even with a playback id', async () => {
    render(<VideoPreview playbackId="pb_1" state="ready" />)
    expect(await screen.findByText(/no playback token yet/i)).toBeInTheDocument()
  })
})
