import { createHash, randomBytes } from 'crypto'

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const rawBytes = randomBytes(32)
  const hex = rawBytes.toString('hex') // 64 hex chars
  const key = `tb_${hex}`
  const prefix = `tb_${hex.slice(0, 8)}...`
  const hash = hashApiKey(key)
  return { key, prefix, hash }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
