import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'
import { InitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoClient, getCognitoConfig } from './lib/cognito/client'
import { verifyCognitoToken } from './lib/cognito/jwt'
import { computeSecretHash } from './lib/cognito/secret-hash'

const PROTECTED_ROUTES = [
  '/home',
  '/mcp-tests',
  '/create-tests',
  '/all-tests',
  '/test-lists',
  '/monitoring',
  '/profile',
  '/plan-billing',
  '/api-keys',
]

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password']

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
}

/**
 * Attempts to issue a new access token using the refresh token.
 * Requires the Cognito username for SECRET_HASH computation — extracted from
 * the (possibly expired) access token or the cognito_username cookie set at login.
 */
async function tryRefreshAccessToken(
  refreshToken: string,
  cognitoUsername: string
): Promise<string | null> {
  try {
    const { clientId, clientSecret } = getCognitoConfig()
    const secretHash = await computeSecretHash(cognitoUsername, clientId, clientSecret)

    const result = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: secretHash,
        },
      })
    )

    return result.AuthenticationResult?.AccessToken ?? null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API key-authenticated endpoints — reduces latency
  if (pathname === '/api/upload-artifacts' || pathname === '/api/mcp-telemetry/ingest') {
    const response = NextResponse.next({ request })
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
    })
  }

  const isProtected = PROTECTED_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/')
  )
  const isAuthRoute = AUTH_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/')
  )

  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value

  // Fast path: verify existing access token locally (no network call)
  let user = accessToken ? await verifyCognitoToken(accessToken) : null
  let newAccessToken: string | undefined

  // If access token is invalid/expired but we have a refresh token, attempt refresh
  if (!user && refreshToken) {
    // Get Cognito username from expired token (decodeJwt doesn't check expiry/signature)
    // or from the cognito_username cookie set at login time
    let cognitoUsername: string | undefined
    if (accessToken) {
      try {
        const claims = decodeJwt(accessToken)
        cognitoUsername = (claims['cognito:username'] as string) ?? (claims.sub as string)
      } catch {
        // ignore decode errors
      }
    }
    cognitoUsername ??= request.cookies.get('cognito_username')?.value

    if (cognitoUsername) {
      const refreshed = await tryRefreshAccessToken(refreshToken, cognitoUsername)
      if (refreshed) {
        newAccessToken = refreshed
        user = await verifyCognitoToken(newAccessToken)
      }
    }
  }

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && user) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/home'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  const response = NextResponse.next({ request })
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))

  // Propagate the refreshed access token cookie
  if (newAccessToken) {
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
