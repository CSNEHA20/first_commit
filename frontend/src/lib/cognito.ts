/**
 * PolicyLab AWS Cognito Integration Service
 * Provides direct, browser-native authentication with AWS Cognito User Pools:
 * - Google Identity Federation (via Cognito Hosted UI / OAuth 2.0)
 * - Native Email/Password Sign-Up (sends real email verification code via AWS)
 * - Native Email Confirmation (verifies 6-digit OTP code)
 * - Native Email/Password Sign-In (returns real OIDC ID Token & claims)
 */

import { setCognitoToken, UserProfile } from './auth'

export interface CognitoConfig {
  region: string
  userPoolId: string
  clientId: string
  domain: string
  redirectUri: string
}

export const COGNITO_CONFIG: CognitoConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_JSKBNDt51',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '1oqk3mk4j4em9k311gcmv2rv9v',
  domain: import.meta.env.VITE_COGNITO_DOMAIN || 'https://policylab.auth.us-east-1.amazoncognito.com',
  // Strict matching with Cognito Allowed Callback URLs (no trailing slash)
  redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
}

/**
 * Initiates real Google OAuth Sign-In via AWS Cognito Hosted UI
 */
export function redirectToGoogleOAuth(): void {
  const { domain, clientId, redirectUri } = COGNITO_CONFIG
  const cleanDomain = domain.replace(/\/$/, '')
  
  // Standard Cognito OAuth authorize endpoint for Google Identity Provider
  const authUrl = `${cleanDomain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&client_id=${clientId}&scope=email+openid+profile`
  
  window.location.href = authUrl
}

/**
 * Initiates standard Cognito Hosted Login UI (Google + Email)
 */
export function redirectToCognitoHostedUI(): void {
  const { domain, clientId, redirectUri } = COGNITO_CONFIG
  const cleanDomain = domain.replace(/\/$/, '')
  const authUrl = `${cleanDomain}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(
    redirectUri
  )}`
  
  window.location.href = authUrl
}

/**
 * Exchanges OAuth authorization code for Cognito ID & Access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<UserProfile | null> {
  const { domain, clientId, redirectUri } = COGNITO_CONFIG
  const cleanDomain = domain.replace(/\/$/, '')
  const tokenEndpoint = `${cleanDomain}/oauth2/token`

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  })

  try {
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Cognito Token Exchange Error:', errorText)
      return null
    }

    const data = await res.json()
    if (data.id_token) {
      return setCognitoToken(data.id_token)
    }
  } catch (err) {
    console.error('Network error during Cognito token exchange:', err)
  }
  return null
}

/**
 * Checks URL for Cognito OAuth redirect tokens or codes
 * If present, stores the token and cleans the URL.
 */
export async function handleCognitoRedirectCallback(): Promise<UserProfile | null> {
  if (typeof window === 'undefined') return null

  // 1. Check for OAuth Error in URL params
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  
  const oauthError = searchParams.get('error_description') || searchParams.get('error') || hashParams.get('error_description') || hashParams.get('error')
  if (oauthError) {
    console.error('Cognito OAuth Error received:', oauthError)
    window.history.replaceState(null, '', window.location.pathname)
    return null
  }

  // 2. Check URL hash for implicit token response (#id_token=...)
  const idToken = hashParams.get('id_token')
  if (idToken) {
    try {
      const user = setCognitoToken(idToken)
      window.history.replaceState(null, '', window.location.pathname)
      return user
    } catch (err) {
      console.error('Failed to parse Cognito ID token from URL hash:', err)
    }
  }

  // 3. Check URL search query for authorization code response (?code=...)
  const code = searchParams.get('code')
  if (code) {
    window.history.replaceState(null, '', window.location.pathname)
    const user = await exchangeCodeForTokens(code)
    return user
  }

  return null
}

/**
 * Helper to call AWS Cognito Identity Provider Service JSON-RPC API
 */
async function callCognitoIdp(action: string, payload: Record<string, any>): Promise<any> {
  const endpoint = `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    const errorMsg = data.message || data.Message || data.__type || 'Cognito authentication request failed'
    throw new Error(errorMsg)
  }
  return data
}

/**
 * Real Cognito Email Sign-Up (Triggers AWS to send verification OTP code to email)
 */
export async function cognitoSignUp(email: string, password: string): Promise<{ userConfirmed: boolean; userSub: string }> {
  const data = await callCognitoIdp('SignUp', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
  })

  return {
    userConfirmed: data.UserConfirmed || false,
    userSub: data.UserSub || '',
  }
}

/**
 * Real Cognito Confirmation (Verifies the 6-digit email OTP)
 */
export async function cognitoConfirmSignUp(email: string, confirmationCode: string): Promise<boolean> {
  await callCognitoIdp('ConfirmSignUp', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    ConfirmationCode: confirmationCode,
  })
  return true
}

/**
 * Real Cognito Email/Password Sign-In
 */
export async function cognitoSignIn(email: string, password: string): Promise<UserProfile> {
  const data = await callCognitoIdp('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CONFIG.clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  })

  if (data.AuthenticationResult && data.AuthenticationResult.IdToken) {
    const idToken = data.AuthenticationResult.IdToken
    return setCognitoToken(idToken)
  }

  if (data.ChallengeName) {
    throw new Error(`Authentication challenge required: ${data.ChallengeName}`)
  }

  throw new Error('No authentication tokens received from Amazon Cognito.')
}
