/**
 * WorkspaceProvider
 *
 * Provides workspace context and state management across the application.
 */

import React, { useReducer, useMemo } from "react"
import {
  WorkspaceContext,
  workspaceReducer,
  buildInitialState,
  DEFAULT_CONNECTED_DATA,
} from "./workspaceStore"

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, buildInitialState)

  const activeWorkspace = useMemo(() => {
    if (!state.activeWorkspaceId) return null
    return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || null
  }, [state.workspaces, state.activeWorkspaceId])

  const isDemoMode = !activeWorkspace || activeWorkspace.mode === "demo"

  const connectedData = useMemo(() => {
    if (!activeWorkspace || activeWorkspace.mode !== "connected") return null
    return activeWorkspace.connected || DEFAULT_CONNECTED_DATA
  }, [activeWorkspace])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      activeWorkspace,
      isDemoMode,
      connectedData,
    }),
    [state, dispatch, activeWorkspace, isDemoMode, connectedData]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
