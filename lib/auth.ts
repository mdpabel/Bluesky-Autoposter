export const COOKIE_NAME = 'auth_token'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function getAuthToken(): Promise<string> {
  const encoder = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(process.env.CRON_SECRET ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const payload = `${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASSWORD}`
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
