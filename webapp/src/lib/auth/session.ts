import { cookies } from 'next/headers'
import { verifySession } from './index'
import { db } from '../db'
import { users, profiles } from '../db/schema'
import { eq } from 'drizzle-orm'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('testbot-session')?.value
  if (!token) return null

  const payload = await verifySession(token)
  if (!payload) return null

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
  return user ?? null
}

export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  return { user, profile: profile ?? null }
}
