import { NextRequest, NextResponse } from 'next/server'
import { InitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient, getCognitoConfig } from '@/lib/cognito/client'
import { computeSecretHash } from '@/lib/cognito/secret-hash'

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { clientId, clientSecret } = getCognitoConfig()
    const username = (email as string).toLowerCase()
    const secretHash = await computeSecretHash(username, clientId, clientSecret)

    const result = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      })
    )

    const auth = result.AuthenticationResult
    if (!auth?.AccessToken || !auth?.RefreshToken) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('access_token', auth.AccessToken, COOKIE_OPTS(3600))
    response.cookies.set('refresh_token', auth.RefreshToken, COOKIE_OPTS(30 * 24 * 3600))
    // Store username so middleware can compute SECRET_HASH during token refresh
    response.cookies.set('cognito_username', username, COOKIE_OPTS(30 * 24 * 3600))
    return response
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (name === 'UserNotConfirmedException') {
      return NextResponse.json({ error: 'Account not verified. Please check your email for the verification code.' }, { status: 403 })
    }
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
