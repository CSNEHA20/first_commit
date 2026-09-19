import React, { useEffect, useState } from 'react'
import {
  UserProfile,
  UserRole,
  getStoredUser,
  subscribeAuth,
  switchDemoRole,
} from '@/lib/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

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

  const roleMeta = ROLE_METADATA[user.role] || ROLE_METADATA.approver

  return (
    <div className='flex items-center gap-2'>
      <Select value={user.role} onValueChange={handleRoleChange}>
        <SelectTrigger
          className='h-7 px-2.5 py-1 text-xs gap-1.5 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] text-foreground focus:ring-1 focus:ring-orange-500/50 rounded-md transition-colors'
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
    </div>
  )
}
