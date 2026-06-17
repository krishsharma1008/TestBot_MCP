import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'

let _client: CognitoIdentityProviderClient | null = null

export function getCognitoClient(): CognitoIdentityProviderClient {
  if (_client) return _client
  const region = process.env.AWS_REGION
  if (!region) throw new Error('AWS_REGION env var is not set')
  _client = new CognitoIdentityProviderClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  return _client
}

export function getCognitoConfig() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_CLIENT_ID
  const clientSecret = process.env.COGNITO_CLIENT_SECRET
  const region = process.env.AWS_REGION
  if (!userPoolId || !clientId || !clientSecret || !region) {
    throw new Error('Missing Cognito configuration: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, AWS_REGION must all be set')
  }
  return { userPoolId, clientId, clientSecret, region }
}
