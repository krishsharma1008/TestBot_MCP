import { cookies } from 'next/headers'
import { verifyCognitoToken } from '../cognito/jwt'
import { db } from '../db'
import { profiles } from '../db/schema'
import { eq } from 'drizzle-orm'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return null
  const claims = await verifyCognitoToken(token)
  if (!claims) return null
  return { id: claims.sub, email: claims.email }
}

export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  return { user, profile: profile ?? null }
}
