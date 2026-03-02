import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateApiKey } from '@/lib/utils/api-keys'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        key_prefix: apiKeys.keyPrefix,
        last_used_at: apiKeys.lastUsedAt,
        expires_at: apiKeys.expiresAt,
        is_active: apiKeys.isActive,
        created_at: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[API Keys] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, expires_at } = body as { name: string; expires_at?: string }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
  }

  const { key, prefix, hash } = generateApiKey()

  try {
    const [data] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        name: name.trim(),
        keyPrefix: prefix,
        keyHash: hash,
        isActive: true,
        expiresAt: expires_at ? new Date(expires_at) : null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        key_prefix: apiKeys.keyPrefix,
        created_at: apiKeys.createdAt,
      })

    return NextResponse.json({ data: { ...data, key } }, { status: 201 })
  } catch (error) {
    console.error('[API Keys] POST error:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
