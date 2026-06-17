import { NextRequest, NextResponse } from 'next/server'
import { ConfirmForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient, getCognitoConfig } from '@/lib/cognito/client'
import { computeSecretHash } from '@/lib/cognito/secret-hash'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code, new_password } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Reset code is required' }, { status: 400 })
    }
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const { clientId, clientSecret } = getCognitoConfig()
    const username = email.toLowerCase()
    const secretHash = await computeSecretHash(username, clientId, clientSecret)

    await getCognitoClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code.trim(),
        Password: new_password,
        SecretHash: secretHash,
      })
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name
    if (name === 'CodeMismatchException') {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 })
    }
    if (name === 'ExpiredCodeException') {
      return NextResponse.json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 })
    }
    if (name === 'InvalidPasswordException') {
      return NextResponse.json({ error: 'Password does not meet requirements' }, { status: 400 })
    }
    console.error('Confirm reset password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
