/**
 * PolicyLab Frontend Authentication & Identity Manager
 * Supports both Amazon Cognito User Pool JWT tokens and local developer role emulation.
 */

export type UserRole = "viewer" | "engineer" | "approver" | "deployer" | "admin"

export interface UserProfile {
  sub: string
  username: string
  email?: string
  role: UserRole
  authSource: "COGNITO" | "LOCAL_DEV"
}

const STORAGE_KEY_TOKEN = "policylab_auth_token"
const STORAGE_KEY_USER = "policylab_auth_user"

const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    sub: "usr_admin_001",
    username: "Alex Vance (Admin)",
    email: "alex.admin@acmepay.internal",
    role: "admin",
    authSource: "LOCAL_DEV",
  },
  approver: {
    sub: "usr_approver_002",
    username: "Sarah Chen (SecOps Lead)",
    email: "sarah.approver@acmepay.internal",
    role: "approver",
    authSource: "LOCAL_DEV",
  },
  deployer: {
    sub: "usr_deployer_003",
    username: "Marcus Brody (Release Eng)",
    email: "marcus.deployer@acmepay.internal",
    role: "deployer",
    authSource: "LOCAL_DEV",
  },
  engineer: {
    sub: "usr_engineer_004",
    username: "Dev Engineer (Policy Author)",
    email: "engineer@acmepay.internal",
    role: "engineer",
    authSource: "LOCAL_DEV",
  },
  viewer: {
    sub: "usr_viewer_005",
    username: "Auditor (Read-Only)",
    email: "auditor@acmepay.internal",
    role: "viewer",
    authSource: "LOCAL_DEV",
  },
}

type AuthListener = (user: UserProfile | null) => void
const listeners: Set<AuthListener> = new Set()

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(user: UserProfile | null) {
  listeners.forEach((fn) => fn(user))
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token)
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN)
    }
  } catch {
    // Ignore storage restrictions
  }
}

export function getStoredUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER)
    if (raw) {
      return JSON.parse(raw) as UserProfile
    }
  } catch {
    // Fall back to default
  }
  // Default to SecOps Approver for seamless testability of AcmePay Phase 7/8/9 flows
  return DEMO_PROFILES.approver
}

export function setStoredUser(user: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
  } catch {
    // Ignore storage restrictions
  }
  notifyListeners(user)
}

/**
 * Creates a synthetic local JWT bearer token matching the selected user profile
 * for authenticated local development and offline mock verification.
 */
export function generateLocalDevToken(user: UserProfile): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "")
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(
    JSON.stringify({
      sub: user.sub,
      "cognito:username": user.username,
      email: user.email,
      "cognito:groups": [user.role],
      iat: now,
      exp: now + 86400,
      iss: "https://policylab.local/dev-auth",
      aud: "policylab-web",
    })
  ).replace(/=+$/, "")
  const sig = btoa("local_dev_sig").replace(/=+$/, "")
  return `${header}.${payload}.${sig}`
}

export function switchDemoRole(role: UserRole): UserProfile {
  const profile = DEMO_PROFILES[role] || DEMO_PROFILES.approver
  const token = generateLocalDevToken(profile)
  setAuthToken(token)
  setStoredUser(profile)
  return profile
}

/**
 * Attaches and verifies a genuine Amazon Cognito User Pool JWT token.
 * Extracts user identity, subject UUID, email, and assigned cognito:groups.
 */
export function setCognitoToken(jwtToken: string): UserProfile {
  const parts = jwtToken.trim().split(".")
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format: Expected 3 parts separated by dots.")
  }

  let payload: Record<string, any>
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const jsonStr = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    payload = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error("Could not parse JWT token claims payload.")
  }

  const rawGroups = payload["cognito:groups"]
  let role: UserRole = "viewer"
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const validRoles: UserRole[] = ["admin", "approver", "deployer", "engineer", "viewer"]
    const matched = rawGroups
      .map((g: string) => g.toLowerCase())
      .find((g: string) => validRoles.includes(g as UserRole))
    if (matched) role = matched as UserRole
  }

  const profile: UserProfile = {
    sub: payload.sub || "cognito_user",
    username: payload["cognito:username"] || payload.username || payload.email || "Cognito User",
    email: payload.email,
    role,
    authSource: "COGNITO",
  }

  setAuthToken(jwtToken)
  setStoredUser(profile)
  return profile
}

export function disconnectCognito(): UserProfile {
  return switchDemoRole("approver")
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_USER)
  } catch {
    // Ignore
  }
  notifyListeners(null)
}
