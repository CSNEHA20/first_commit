import React, { useEffect, useState } from 'react'
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

      {/* Cognito JWT Modal */}
      {showCognitoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel-premium w-full max-w-md p-5 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Amazon Cognito Authentication
                </h3>
              </div>
              <button
                onClick={() => setShowCognitoModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Currently authenticated via:{" "}
                <strong className={isCognito ? "text-cyan-300" : "text-amber-300"}>
                  {isCognito ? "Amazon Cognito User Pool ID Token" : "Local Development Synthetic Token"}
                </strong>
              </p>
              <p className="text-[11px]">
                To test real Cognito verification with AWS API Gateway HTTP API, paste a genuine Cognito ID or Access token below.
              </p>
            </div>

            <div className="space-y-2">
              <textarea
                value={jwtInput}
                onChange={(e) => setJwtInput(e.target.value)}
                placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                className="w-full h-24 p-2.5 rounded-lg bg-black/60 border border-white/15 text-[11px] font-mono text-foreground focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
              />
              {jwtError && (
                <p className="text-red-400 text-xs font-mono">{jwtError}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              {isCognito ? (
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 border-red-500/40 text-red-300 hover:bg-red-950/30 gap-1.5"
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
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyCognitoToken}
                  disabled={!jwtInput.trim()}
                  size="sm"
                  className="text-xs h-8 bg-cyan-600 text-white hover:bg-cyan-500 gap-1.5 font-semibold"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply Cognito Token</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
