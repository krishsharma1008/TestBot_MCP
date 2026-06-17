import { NextRequest, NextResponse } from 'next/server'
import { GlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient } from '@/lib/cognito/client'

const CLEAR_COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 }

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value

  if (accessToken) {
    try {
      await getCognitoClient().send(new GlobalSignOutCommand({ AccessToken: accessToken }))
    } catch {
      // Best-effort — clear cookies regardless
    }
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('access_token', '', CLEAR_COOKIE)
  response.cookies.set('refresh_token', '', CLEAR_COOKIE)
  response.cookies.set('cognito_username', '', CLEAR_COOKIE)
  return response
}
