import { NextRequest, NextResponse } from 'next/server'
import { ForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient, getCognitoConfig } from '@/lib/cognito/client'
import { computeSecretHash } from '@/lib/cognito/secret-hash'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { clientId, clientSecret } = getCognitoConfig()
    const username = email.toLowerCase()
    const secretHash = await computeSecretHash(username, clientId, clientSecret)

    await getCognitoClient().send(
      new ForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        SecretHash: secretHash,
      })
    )

    // Always return success to avoid user enumeration
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name
    // Return success even for non-existent users to prevent user enumeration
    if (name === 'UserNotFoundException' || name === 'NotAuthorizedException') {
      return NextResponse.json({ success: true })
    }
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
