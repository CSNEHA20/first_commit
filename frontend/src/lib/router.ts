/**
 * PolicyLab Lightweight URL Hash Router
 * Enables deep linking, back/forward navigation, and smooth workspace state synchronization.
 */

import { useState, useEffect, useCallback } from 'react'
import { ActiveTab } from '@/components/layout/AppSidebar'

export type AppRoute =
  | { type: 'landing' }
  | { type: 'console' }
  | { type: 'auth'; returnTo?: string }
  | { type: 'workspace'; workspaceId: string; tab: ActiveTab }

export function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, '').trim()
  if (!clean || clean === 'landing') {
    return { type: 'landing' }
  }
  if (clean === 'console' || clean === 'hub') {
    return { type: 'console' }
  }
  if (clean.startsWith('auth') || clean === 'login' || clean === 'signup') {
    const params = new URLSearchParams(clean.split('?')[1] || '')
    return { type: 'auth', returnTo: params.get('returnTo') || undefined }
  }

  // format: workspace/:id/:tab or workspace/:id
  const parts = clean.split('/')
  if (parts[0] === 'workspace' && parts[1]) {
    const workspaceId = parts[1]
    const validTabs: ActiveTab[] = [
      'overview',
      'policies',
      'simulator',
      'changes',
      'tests',
      'deployments',
      'audit',
    ]
    const candidateTab = parts[2] as ActiveTab
    const tab: ActiveTab = validTabs.includes(candidateTab) ? candidateTab : 'overview'
    return { type: 'workspace', workspaceId, tab }
  }

  return { type: 'landing' }
}

export function routeToHash(route: AppRoute): string {
  switch (route.type) {
    case 'landing':
      return '#/'
    case 'console':
      return '#/console'
    case 'auth':
      return route.returnTo ? `#/auth?returnTo=${encodeURIComponent(route.returnTo)}` : '#/auth'
    case 'workspace':
      return `#/workspace/${route.workspaceId}/${route.tab}`
  }
}

export function useAppRouter() {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = useCallback((target: AppRoute | string) => {
    if (typeof target === 'string') {
      window.location.hash = target.startsWith('#') ? target : `#/${target.replace(/^\//, '')}`
    } else {
      window.location.hash = routeToHash(target)
    }
  }, [])

  return { route, navigate }
}
