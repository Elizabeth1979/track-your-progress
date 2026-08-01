/**
 * Invite links carry a short human-readable code plus a high-entropy secret. Only the
 * SHA-256 of the secret is stored, so a database leak cannot be replayed into a family.
 */

// Excludes I, O, 0 and 1, which people mistype when reading a code aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomFrom(alphabet: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export function generateInviteCode(): string {
  return randomFrom(CODE_ALPHABET, 6)
}

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function inviteUrl(code: string, token: string): string {
  return `${window.location.origin}/join/${code}?t=${encodeURIComponent(token)}`
}

export const INVITE_TTL_DAYS = 7
