/**
 * PolicyLab Workspace State Store
 *
 * Manages two workspace modes:
 *   - "demo"      : AcmePay benchmark fixtures -- hardcoded, never mixed with connected workspaces.
 *   - "connected" : Engineer-supplied Cedar policies, schema, entities, and scenarios.
 *
 * State is session-scoped (localStorage for workspace list, in-memory for analysis results).
 * Results are clearly labeled with their evaluation source.
 */

import { createContext, useContext } from "react"
import type { Scenario, SecurityContract } from "../types/authz.ts"

// --- Source Labels -----------------------------------------------------------
export type EvaluationSource =
  | "LOCAL_CEDAR_WASM"   // Deterministic local Cedar WASM engine
  | "FIXTURE_PREVIEW"    // AcmePay demo fixture data
  | "AVP_REMOTE"         // Amazon Verified Permissions (only when a real request succeeded)

// --- Workspace Types ----------------------------------------------------------
export type WorkspaceMode = "demo" | "connected"

export interface ConnectedWorkspaceData {
  /** Canonical Cedar policy text for baseline and candidate */
  baselinePolicyText: string
  baselineLabel: string
  candidatePolicyText: string
  candidateLabel: string
  /** Cedar schema JSON string -- optional, warning displayed if absent */
  schemaText: string
  /** Cedar entities JSON array string -- optional */
  entitiesJson: string
  /** Declared scenario universe -- required to run analysis */
  scenarios: Scenario[]
  /** Security contracts to enforce -- may be empty for connected workspace */
  contracts: SecurityContract[]
  /** Import source metadata */
  importSource: "MANUAL" | "GITHUB" | "LOCAL_CLI" | "AVP"
  /** Repository or file path metadata for traceability */
  sourceRef?: string
  /** Whether analysis results are stale (candidate changed since last run) */
  analysisStale: boolean
  /** Whether approval state is stale (candidate changed after approval) */
  approvalStale: boolean
  /** Timestamp of last successful analysis */
  lastAnalyzedAt: string | null
  /** Source of the last analysis results */
  lastAnalysisSource: EvaluationSource | null
}

export interface Workspace {
  id: string
  mode: WorkspaceMode
  name: string
  createdAt: string
  /** Only present for connected workspaces */
  connected?: ConnectedWorkspaceData
}

// --- Default Connected Data --------------------------------------------------
export const DEFAULT_CONNECTED_DATA: ConnectedWorkspaceData = {
  baselinePolicyText: "",
  baselineLabel: "Baseline",
  candidatePolicyText: "",
  candidateLabel: "Candidate",
  schemaText: "",
  entitiesJson: "",
  scenarios: [],
  contracts: [],
  importSource: "MANUAL",
  sourceRef: undefined,
  analysisStale: false,
  approvalStale: false,
  lastAnalyzedAt: null,
  lastAnalysisSource: null,
}

// --- Demo Workspace (singleton, always present) ------------------------------
export const DEMO_WORKSPACE: Workspace = {
  id: "ws-acmepay-demo",
  mode: "demo",
  name: "AcmePay Demo",
  createdAt: "2026-09-18T10:00:00Z",
}

// --- State -------------------------------------------------------------------
export interface WorkspaceState {
  /** All workspaces (demo + any connected) */
  workspaces: Workspace[]
  /** ID of the currently active workspace -- null means workspace selector is shown */
  activeWorkspaceId: string | null
}

const STORAGE_KEY = "policylab_workspaces_v1"

function loadPersistedWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace[]
      return parsed.filter((w) => w.mode === "connected")
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

function persistConnectedWorkspaces(workspaces: Workspace[]): void {
  try {
    const connected = workspaces.filter((w) => w.mode === "connected")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connected))
  } catch {
    // Ignore storage errors
  }
}

export function buildInitialState(): WorkspaceState {
  const persisted = loadPersistedWorkspaces()
  return {
    workspaces: [DEMO_WORKSPACE, ...persisted],
    activeWorkspaceId: null,
  }
}

// --- Actions -----------------------------------------------------------------
export type WorkspaceAction =
  | { type: "SELECT_WORKSPACE"; id: string }
  | { type: "SHOW_WORKSPACE_SELECTOR" }
  | { type: "CREATE_WORKSPACE"; workspace: Workspace }
  | { type: "DELETE_WORKSPACE"; id: string }
  | { type: "UPDATE_CONNECTED_DATA"; id: string; patch: Partial<ConnectedWorkspaceData> }
  | { type: "MARK_ANALYSIS_STALE"; id: string }
  | { type: "MARK_ANALYSIS_FRESH"; id: string; source: EvaluationSource }

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "SELECT_WORKSPACE":
      return { ...state, activeWorkspaceId: action.id }

    case "SHOW_WORKSPACE_SELECTOR":
      return { ...state, activeWorkspaceId: null }

    case "CREATE_WORKSPACE": {
      const next = {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        activeWorkspaceId: action.workspace.id,
      }
      persistConnectedWorkspaces(next.workspaces)
      return next
    }

    case "DELETE_WORKSPACE": {
      if (action.id === DEMO_WORKSPACE.id) return state
      const filtered = state.workspaces.filter((w) => w.id !== action.id)
      const nextActive =
        state.activeWorkspaceId === action.id ? null : state.activeWorkspaceId
      const next = { workspaces: filtered, activeWorkspaceId: nextActive }
      persistConnectedWorkspaces(next.workspaces)
      return next
    }

    case "UPDATE_CONNECTED_DATA": {
      const updated = state.workspaces.map((w) => {
        if (w.id !== action.id || w.mode !== "connected") return w
        const prev = w.connected || DEFAULT_CONNECTED_DATA
        const patched = { ...prev, ...action.patch }
        if (
          action.patch.candidatePolicyText !== undefined &&
          action.patch.candidatePolicyText !== prev.candidatePolicyText
        ) {
          patched.analysisStale = true
          patched.approvalStale = true
        }
        return { ...w, connected: patched }
      })
      const next = { ...state, workspaces: updated }
      persistConnectedWorkspaces(next.workspaces)
      return next
    }

    case "MARK_ANALYSIS_STALE": {
      const updated = state.workspaces.map((w) => {
        if (w.id !== action.id || !w.connected) return w
        return { ...w, connected: { ...w.connected, analysisStale: true } }
      })
      return { ...state, workspaces: updated }
    }

    case "MARK_ANALYSIS_FRESH": {
      const updated = state.workspaces.map((w) => {
        if (w.id !== action.id || !w.connected) return w
        return {
          ...w,
          connected: {
            ...w.connected,
            analysisStale: false,
            lastAnalyzedAt: new Date().toISOString(),
            lastAnalysisSource: action.source,
          },
        }
      })
      const next = { ...state, workspaces: updated }
      persistConnectedWorkspaces(next.workspaces)
      return next
    }

    default:
      return state
  }
}

// --- Context -----------------------------------------------------------------
export interface WorkspaceContextValue {
  state: WorkspaceState
  dispatch: React.Dispatch<WorkspaceAction>
  activeWorkspace: Workspace | null
  isDemoMode: boolean
  connectedData: ConnectedWorkspaceData | null
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return ctx
}
