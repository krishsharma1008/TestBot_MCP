/**
 * Computes the Cognito SECRET_HASH required when using a confidential app client.
 * Uses Web Crypto API (globalThis.crypto.subtle) — works in both Node.js 18+ and Edge runtime.
 * Formula: Base64(HMAC-SHA256(username + clientId, clientSecret))
 */
export async function computeSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(username + clientId)
  )
  return Buffer.from(signature).toString('base64')
}
