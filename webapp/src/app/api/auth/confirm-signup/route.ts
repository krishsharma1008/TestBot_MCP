import { NextRequest, NextResponse } from 'next/server'
import { ConfirmSignUpCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient, getCognitoConfig } from '@/lib/cognito/client'
import { computeSecretHash } from '@/lib/cognito/secret-hash'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code, full_name } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const { clientId, clientSecret, userPoolId } = getCognitoConfig()
    const username = email.toLowerCase()
    const secretHash = await computeSecretHash(username, clientId, clientSecret)

    await getCognitoClient().send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code.trim(),
        SecretHash: secretHash,
      })
    )

    // Get the Cognito sub to use as profiles.id
    const userResult = await getCognitoClient().send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username })
    )
    const sub = userResult.UserAttributes?.find(a => a.Name === 'sub')?.Value
    const cognitoName = userResult.UserAttributes?.find(a => a.Name === 'name')?.Value

    if (sub) {
      await db
        .insert(profiles)
        .values({
          id: sub,
          email: username,
          fullName: full_name ?? cognitoName ?? null,
        })
        .onConflictDoNothing()
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name
    if (name === 'CodeMismatchException') {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }
    if (name === 'ExpiredCodeException') {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }
    if (name === 'NotAuthorizedException') {
      return NextResponse.json({ error: 'Account is already confirmed' }, { status: 400 })
    }
    console.error('Confirm signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
