import bcrypt from 'bcrypt'
import { SignJWT, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

const SALT_ROUNDS = 12
const COOKIE_NAME = 'testbot-session'
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<string> {
  const secret = getJwtSecret()
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
  return token
}

export async function verifySession(token: string): Promise<{ userId: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub) return null
    return { userId: payload.sub }
  } catch {
    return null
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}
