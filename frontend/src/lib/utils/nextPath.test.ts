import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_AUTH, resolveNextPath, safeNextPath, signInUrlFor } from './nextPath'

// `next` arrives from the URL and is therefore attacker-controlled. These tests exist to
// pin the open-redirect boundary, not merely to exercise the happy path — an
// unvalidated `next` would turn our own sign-in form into a phishing hop that runs on
// the genuine domain.
describe('safeNextPath', () => {
  it('accepts ordinary same-document paths', () => {
    expect(safeNextPath('/buy/risk-register-bundle')).toBe('/buy/risk-register-bundle')
    expect(safeNextPath('/library')).toBe('/library')
  })

  it('preserves query and hash, which carry real state on detail routes', () => {
    expect(safeNextPath('/questions?tag=incidents')).toBe('/questions?tag=incidents')
    expect(safeNextPath('/courses/x#syllabus')).toBe('/courses/x#syllabus')
  })

  it.each([
    ['absolute http', 'https://evil.example/steal'],
    ['protocol-relative', '//evil.example'],
    ['backslash-smuggled', '/\\evil.example'],
    ['script URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<script>'],
    ['bare relative', 'dashboard'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, input) => {
    expect(safeNextPath(input as string | null | undefined)).toBeNull()
  })

  it('rejects control characters and leading whitespace rather than trimming them', () => {
    // A leading newline is the classic way to slip a value past a naive startsWith('/').
    expect(safeNextPath('\n/evil')).toBeNull()
    expect(safeNextPath(' /library')).toBeNull()
    expect(safeNextPath('/lib\trary')).toBeNull()
  })

  it('refuses to return to an auth route, which would bounce the visitor back to the form', () => {
    expect(safeNextPath('/sign-in')).toBeNull()
    expect(safeNextPath('/sign-up?next=/x')).toBeNull()
    expect(safeNextPath('/reset-password')).toBeNull()
  })

  it('does not reject a path merely because an auth route name appears inside it', () => {
    expect(safeNextPath('/courses/how-to-sign-in-securely')).toBe('/courses/how-to-sign-in-securely')
  })
})

describe('signInUrlFor', () => {
  it('encodes the destination so query and hash survive the round trip', () => {
    expect(signInUrlFor('/questions?tag=a&x=1')).toBe(
      '/sign-in?next=%2Fquestions%3Ftag%3Da%26x%3D1',
    )
  })

  it('falls back to a bare /sign-in when the origin is not returnable', () => {
    expect(signInUrlFor('https://evil.example')).toBe('/sign-in')
    expect(signInUrlFor('/sign-in')).toBe('/sign-in')
  })
})

describe('resolveNextPath', () => {
  it('round-trips what signInUrlFor produced', () => {
    const url = signInUrlFor('/buy/risk-register-bundle')
    expect(resolveNextPath(url.slice(url.indexOf('?')))).toBe('/buy/risk-register-bundle')
  })

  it('defaults to the dashboard when absent or unsafe', () => {
    expect(resolveNextPath('')).toBe(DEFAULT_AFTER_AUTH)
    expect(resolveNextPath('?next=https://evil.example')).toBe(DEFAULT_AFTER_AUTH)
  })
})
