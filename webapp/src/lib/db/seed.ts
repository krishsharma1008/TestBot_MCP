import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { hashPassword } from '../auth'
import { randomBytes, createHash } from 'crypto'
import { eq } from 'drizzle-orm'

const { users, profiles, apiKeys } = schema

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  const devEmail = 'dev@testbot.local'
  const devPassword = 'password123'

  console.log('Seeding dev user...')

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, devEmail))
    .limit(1)

  let userId: string

  if (existingUsers.length > 0) {
    userId = existingUsers[0].id
    console.log(`User ${devEmail} already exists, skipping user creation.`)
  } else {
    const passwordHash = await hashPassword(devPassword)
    const [newUser] = await db
      .insert(users)
      .values({ email: devEmail, passwordHash })
      .returning()
    userId = newUser.id
    console.log(`Created user: ${devEmail}`)
  }

  const existingProfiles = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)

  if (existingProfiles.length === 0) {
    await db.insert(profiles).values({
      id: userId,
      email: devEmail,
      fullName: 'Dev User',
      plan: 'starter',
      creditsRemaining: 100,
      creditsTotal: 100,
    })
    console.log('Created profile for dev user.')
  } else {
    console.log('Profile already exists, skipping profile creation.')
  }

  const rawKey = randomBytes(32).toString('hex')
  const keyPrefix = rawKey.slice(0, 8)
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  await db.insert(apiKeys).values({
    userId,
    name: 'Default Key',
    keyPrefix,
    keyHash,
    isActive: true,
  })

  console.log('\n--- Dev API Key ---')
  console.log(`Full API Key: ${rawKey}`)
  console.log(`Prefix: ${keyPrefix}`)
  console.log('-------------------\n')
  console.log('Store this key safely — it will not be shown again.')

  await client.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
