import React, { useState } from 'react'
import {
  Shield,
  Key,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  switchDemoRole,
  UserRole,
} from '@/lib/auth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTab?: 'signin' | 'signup' | 'guide' | 'dev'
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'signin',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'guide' | 'dev'>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [needsCodeVerification, setNeedsCodeVerification] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    setAuthError(null)
    // Check if Cognito Domain is configured in environment
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const redirectUri = window.location.origin

    if (cognitoDomain && clientId) {
      // Redirect to Cognito Hosted UI with Google IdP
      const authUrl = `${cognitoDomain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&client_id=${clientId}&scope=email+openid+profile`
      window.location.href = authUrl
    } else {
      // Graceful instant simulated Google Auth in dev mode
      setTimeout(() => {
        setIsLoading(false)
        switchDemoRole('admin')
        onSuccess()
      }, 700)
    }
  }

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError(null)

    if (activeTab === 'signup' && !needsCodeVerification) {
      // Simulate/trigger sending email code
      setTimeout(() => {
        setIsLoading(false)
        setNeedsCodeVerification(true)
        setAuthSuccessMsg(
          `Verification code sent to ${email}. (In local dev mode, enter any 6-digit code e.g. 123456)`
        )
      }, 800)
      return
    }

    if (activeTab === 'signup' && needsCodeVerification) {
      if (!confirmCode.trim()) {
        setIsLoading(false)
        setAuthError('Please enter the 6-digit verification code.')
        return
      }
      setTimeout(() => {
        setIsLoading(false)
        switchDemoRole('engineer')
        onSuccess()
      }, 600)
      return
    }

    // Sign In Flow
    setTimeout(() => {
      setIsLoading(false)
      switchDemoRole('approver')
      onSuccess()
    }, 600)
  }

  const handleSelectDevPersona = (role: UserRole) => {
    switchDemoRole(role)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel-premium w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-md">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                PolicyLab Identity & Access
              </h2>
              <p className="text-xs text-muted-foreground">
                Deterministic AWS Verified Permissions Workstation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-mono p-1 rounded-md hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border bg-muted/30 px-5 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('signin')
              setNeedsCodeVerification(false)
            }}
            className={`py-3 px-3 border-b-2 font-semibold transition-all ${
              activeTab === 'signin'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab('signup')
              setNeedsCodeVerification(false)
            }}
            className={`py-3 px-3 border-b-2 font-semibold transition-all ${
              activeTab === 'signup'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => setActiveTab('dev')}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'dev'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Dev Personas</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Cognito Guide</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {authError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {(activeTab === 'signin' || activeTab === 'signup') && (
            <div className="space-y-4">
              {/* Google OAuth Button */}
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-10 gap-3 text-xs font-semibold border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (AWS Cognito Federated)</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-[1px] flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">
                  or email address
                </span>
                <div className="h-[1px] flex-1 bg-border" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Work Email</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah.lin@acmepay.internal"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                  />
                </div>

                {needsCodeVerification && (
                  <div className="space-y-1 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                    <label className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      <span>6-Digit Email Verification Code</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      placeholder="123456"
                      className="w-full h-9 px-3 text-xs rounded-lg border border-orange-500/40 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono tracking-widest text-center text-sm font-bold"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-9 text-xs font-bold bg-[#FF6A24] text-white hover:bg-[#FF8A42] gap-1.5 shadow-md transition-transform hover:scale-[1.01]"
                >
                  <span>
                    {isLoading
                      ? 'Authenticating...'
                      : activeTab === 'signup'
                      ? needsCodeVerification
                        ? 'Confirm & Create Account'
                        : 'Send Verification Code'
                      : 'Sign In to Workbench'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          )}

          {/* Dev Personas Tab */}
          {activeTab === 'dev' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Instantly switch roles in local developer mode to test Cedar RBAC/ABAC authorization policies:
              </p>

              <div className="space-y-2">
                {[
                  {
                    role: 'admin' as UserRole,
                    title: 'Sarah Lin (SecOps Admin)',
                    desc: 'Full administrative access and policy authoring privileges.',
                    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                  },
                  {
                    role: 'approver' as UserRole,
                    title: 'Marcus Vance (SecOps Approver)',
                    desc: 'Can review behavioral diffs and issue cryptographic approvals.',
                    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
                  },
                  {
                    role: 'deployer' as UserRole,
                    title: 'Alex Chen (Release Eng)',
                    desc: 'Can trigger gated production deployments to Amazon Verified Permissions.',
                    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
                  },
                  {
                    role: 'engineer' as UserRole,
                    title: 'Elena Rostova (Policy Author)',
                    desc: 'Can edit Cedar policies and simulate authorization queries.',
                    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                  },
                ].map((item) => (
                  <button
                    key={item.role}
                    onClick={() => handleSelectDevPersona(item.role)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-card hover:bg-muted hover:border-orange-500/50 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {item.title}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${item.badge}`}
                        >
                          {item.role.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cognito & Supabase Configuration Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed font-sans">
              <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <span>Configuring Amazon Cognito & Google Federation</span>
                </div>
                <p className="text-[11px]">
                  PolicyLab natively validates AWS Cognito User Pool JWTs using Amazon Verified Permissions entity mappings.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>
                    In <strong>AWS Management Console</strong>, navigate to <strong>Amazon Cognito</strong> &gt; <strong>User Pools</strong>.
                  </li>
                  <li>
                    Under <strong>Sign-in experience</strong>, add <strong>Google</strong> as a Federated Identity Provider with your Google Cloud OAuth Client ID & Secret.
                  </li>
                  <li>
                    Under <strong>App integration</strong>, configure the Callback URL to your PolicyLab URL (e.g. <code>http://localhost:5173</code>).
                  </li>
                  <li>
                    Set environment variables in <code>frontend/.env</code>:
                    <pre className="mt-1 p-2 rounded bg-black/80 text-orange-400 font-mono text-[10px] overflow-x-auto">
{`VITE_COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=your_cognito_app_client_id
VITE_COGNITO_REGION=us-east-1`}
                    </pre>
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Key className="h-4 w-4 text-cyan-500" />
                  <span>Extracting a Real Token via AWS CLI</span>
                </div>
                <pre className="p-2 rounded bg-black/80 text-cyan-300 font-mono text-[10px] overflow-x-auto">
{`aws cognito-idp initiate-auth \\
  --auth-flow USER_PASSWORD_AUTH \\
  --client-id <YOUR_CLIENT_ID> \\
  --auth-parameters USERNAME=<USER_EMAIL>,PASSWORD=<USER_PASSWORD> \\
  --query "AuthenticationResult.IdToken" --output text`}
                </pre>
                <p className="text-[11px]">
                  Paste the returned ID token into the <strong>DEV TOKEN</strong> header modal to test live Cognito claim extraction in Cedar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
          <span className="text-muted-foreground text-[11px]">
            WeMakeDevs × AWS First Commit 2026
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
