import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

export interface CognitoUserClaims extends JWTPayload {
  sub: string
  email: string
  'cognito:username': string
  token_use: 'access' | 'id'
}

// Cache the JWKS per user pool — keys rotate rarely
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(region: string, userPoolId: string) {
  const key = `${region}:${userPoolId}`
  if (!jwksCache.has(key)) {
    const url = new URL(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    )
    jwksCache.set(key, createRemoteJWKSet(url))
  }
  return jwksCache.get(key)!
}

export async function verifyCognitoToken(token: string): Promise<CognitoUserClaims | null> {
  const region = process.env.AWS_REGION
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  if (!region || !userPoolId) return null

  try {
    const jwks = getJwks(region, userPoolId)
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
    const { payload } = await jwtVerify(token, jwks, { issuer })
    return payload as CognitoUserClaims
  } catch {
    return null
  }
}
