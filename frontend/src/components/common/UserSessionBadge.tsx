import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  UserProfile,
  UserRole,
  getStoredUser,
  subscribeAuth,
  switchDemoRole,
  setCognitoToken,
  disconnectCognito,
} from '@/lib/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Key, Shield, LogOut, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ROLE_METADATA: Record<
  UserRole,
  { label: string; badgeClass: string; desc: string }
> = {
  admin: {
    label: 'Admin',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'Full administrative & bypass control',
  },
  approver: {
    label: 'SecOps Approver',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    desc: 'Can issue cryptographic approval tokens',
  },
  deployer: {
    label: 'Release Eng',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    desc: 'Can trigger gated production deployments',
  },
  engineer: {
    label: 'Policy Author',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Can author and simulate Cedar policies',
  },
  viewer: {
    label: 'Auditor (Read-Only)',
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    desc: 'Read-only audit access',
  },
}

export const UserSessionBadge: React.FC = () => {
  const [user, setUser] = useState<UserProfile>(getStoredUser)
  const [showCognitoModal, setShowCognitoModal] = useState(false)
  const [jwtInput, setJwtInput] = useState('')
  const [jwtError, setJwtError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeAuth((updatedUser) => {
      if (updatedUser) {
        setUser(updatedUser)
      }
    })
    return unsubscribe
  }, [])

  const handleRoleChange = (newRole: string) => {
    const updated = switchDemoRole(newRole as UserRole)
    setUser(updated)
  }

  const handleApplyCognitoToken = () => {
    setJwtError(null)
    try {
      const updated = setCognitoToken(jwtInput)
      setUser(updated)
      setShowCognitoModal(false)
      setJwtInput('')
    } catch (err) {
      setJwtError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDisconnect = () => {
    const updated = disconnectCognito()
    setUser(updated)
    setShowCognitoModal(false)
  }

  const roleMeta = ROLE_METADATA[user.role] || ROLE_METADATA.approver
  const isCognito = user.authSource === 'COGNITO'

  return (
    <div className='flex items-center gap-2 shrink-0'>
      {/* Auth Source Badge */}
      <button
        onClick={() => setShowCognitoModal(true)}
        className={`h-7 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-[11px] font-mono px-2.5 rounded-md border font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
          isCognito
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
            : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-100'
        }`}
        title="Click to configure Amazon Cognito User Pool JWT"
      >
        <Key className="h-3 w-3 shrink-0" />
        <span className="leading-none whitespace-nowrap">{isCognito ? 'COGNITO JWT' : 'DEV TOKEN'}</span>
      </button>

      {/* Role Selection Dropdown */}
      <Select value={user.role} onValueChange={handleRoleChange}>
        <SelectTrigger
          className='h-7 shrink-0 px-2.5 py-1 text-xs gap-1.5 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] text-foreground focus:ring-1 focus:ring-orange-500/50 rounded-md transition-colors'
          title={`Active identity: ${user.username} (${user.email || 'no email'})`}
        >
          <div className='flex items-center gap-1.5 font-mono'>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${roleMeta.badgeClass}`}
            >
              {roleMeta.label}
            </span>
            <span className='text-muted-foreground hidden xl:inline text-[11px] truncate max-w-[110px]'>
              {user.username.split(' ')[0]}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent align='end' className='w-56 bg-[#0E1015] border-white/[0.1] text-foreground p-1'>
          <div className='px-2 py-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-white/[0.06] mb-1'>
            Switch Emulated Identity (RBAC)
          </div>
          {(Object.keys(ROLE_METADATA) as UserRole[]).map((roleKey) => {
            const meta = ROLE_METADATA[roleKey]
            return (
              <SelectItem
                key={roleKey}
                value={roleKey}
                className='text-xs py-1.5 focus:bg-white/[0.08] focus:text-foreground cursor-pointer rounded'
              >
                <div className='flex flex-col gap-0.5'>
                  <div className='flex items-center gap-1.5'>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span className='text-[10px] text-muted-foreground leading-tight'>
                    {meta.desc}
                  </span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {/* Cognito JWT Modal — Rendered into document.body to avoid header clipping/transforms */}
      {showCognitoModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pt-16 sm:pt-20 pb-8 animate-in fade-in duration-200">
            <div className="bg-[#FFFFFF] dark:bg-[#0F131C] w-full max-w-lg rounded-2xl border border-border dark:border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col max-h-[78vh] overflow-hidden my-auto">
              {/* Modal Header */}
              <div className="p-4 border-b border-border dark:border-white/10 flex items-center justify-between bg-card dark:bg-[#141A26] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-500 dark:text-cyan-400 border border-cyan-500/30">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Amazon Cognito Authentication & Token
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      AWS Verified Permissions Identity & Claims
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCognitoModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1.5 rounded-lg hover:bg-muted dark:hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Active Auth Mode Status */}
                <div className="p-3 rounded-xl bg-muted/40 dark:bg-black/40 border border-border dark:border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono block">Current Identity</span>
                    <strong className={isCognito ? "text-cyan-500 dark:text-cyan-300 font-bold" : "text-amber-500 dark:text-amber-300 font-bold"}>
                      {isCognito ? "Amazon Cognito User Pool ID Token" : "Local Development Synthetic Token"}
                    </strong>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted dark:bg-white/10 text-foreground font-semibold">
                    Role: {user.role}
                  </span>
                </div>

                {/* Quick Test Token Injector */}
                <div className="p-3 rounded-xl bg-card dark:bg-[#141A26] border border-border dark:border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-foreground block font-mono">
                    1-Click Synthetic Token Personas
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: "Admin Persona", role: "admin", email: "admin@policylab.internal" },
                      { label: "Approver Persona", role: "approver", email: "approver@policylab.internal" },
                      { label: "Author Persona", role: "engineer", email: "author@policylab.internal" },
                    ].map((persona) => (
                      <button
                        key={persona.role}
                        onClick={() => {
                          const payload = {
                            sub: `cognito-test-${persona.role}`,
                            "cognito:username": persona.label,
                            email: persona.email,
                            "custom:role": persona.role,
                            "cognito:groups": [persona.role],
                            iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool",
                          }
                          const simulatedJwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload)).replace(/=/g, '')}.simulated_signature`
                          setJwtInput(simulatedJwt)
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-border dark:border-white/15 bg-muted/60 dark:bg-black/50 hover:bg-muted dark:hover:bg-white/10 text-foreground transition-all cursor-pointer font-medium"
                      >
                        + {persona.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* JWT Input Area */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground font-mono flex items-center justify-between">
                    <span>Paste Cognito ID Token (JWT)</span>
                    <span className="text-[10px] text-muted-foreground font-sans">Header + Payload + Signature</span>
                  </label>
                  <textarea
                    value={jwtInput}
                    onChange={(e) => setJwtInput(e.target.value)}
                    placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                    className="w-full h-20 p-2.5 rounded-xl bg-muted/30 dark:bg-black/60 border border-border dark:border-white/15 text-[11px] font-mono text-foreground focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
                  />
                  {jwtError && (
                    <p className="text-red-500 text-xs font-mono">{jwtError}</p>
                  )}
                </div>

                {/* How to Retrieve Token Guide */}
                <details className="p-3 rounded-xl bg-card dark:bg-[#141A26] border border-border dark:border-white/10 space-y-2 group">
                  <summary className="text-xs font-bold text-foreground cursor-pointer font-mono flex items-center justify-between select-none">
                    <span>📖 How to retrieve a token from AWS Cognito</span>
                    <span className="text-muted-foreground text-[10px] group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="pt-2 space-y-2 text-[11px] text-muted-foreground leading-relaxed font-sans">
                    <p>
                      1. In AWS Console &gt; <strong>Amazon Cognito</strong> &gt; <strong>User Pools</strong>, get your <strong>App Client ID</strong>.
                    </p>
                    <p>
                      2. Run this AWS CLI command to authenticate and retrieve a valid ID Token:
                    </p>
                    <pre className="p-2 rounded-lg bg-black text-cyan-300 font-mono text-[10px] overflow-x-auto border border-white/10">
{`aws cognito-idp initiate-auth \\
  --auth-flow USER_PASSWORD_AUTH \\
  --client-id <CLIENT_ID> \\
  --auth-parameters USERNAME=<EMAIL>,PASSWORD=<PASSWORD> \\
  --query "AuthenticationResult.IdToken" --output text`}
                    </pre>
                  </div>
                </details>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border dark:border-white/10 bg-card dark:bg-[#141A26] flex items-center justify-between gap-2 shrink-0">
                {isCognito ? (
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-red-500/40 text-red-500 hover:bg-red-500/10 gap-1.5"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Reset to Dev Mode</span>
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowCognitoModal(false)}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApplyCognitoToken}
                    disabled={!jwtInput.trim()}
                    size="sm"
                    className="text-xs h-8 bg-cyan-600 text-white hover:bg-cyan-500 gap-1.5 font-semibold shadow-md"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply Cognito Token</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
