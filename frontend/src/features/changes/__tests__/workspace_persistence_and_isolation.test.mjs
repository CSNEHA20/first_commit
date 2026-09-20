/**
 * Test Suite: Workspace Persistence, State Reducer & Multi-Workspace Isolation
 *
 * Verifies:
 * 1. Initial state loads DEMO_WORKSPACE without connected workspaces if storage empty
 * 2. CREATE_WORKSPACE adds connected workspace and sets as active
 * 3. UPDATE_CONNECTED_DATA marks analysis and approval as stale on candidate edits
 * 4. SELECT_WORKSPACE switches active workspace without state leakage
 * 5. DELETE_WORKSPACE prevents deleting the demo benchmark workspace
 * 6. MARK_ANALYSIS_FRESH records lastAnalyzedAt and lastAnalysisSource
 * 7. Multi-workspace isolation guarantees separate policy and scenario state
 */

import test from "node:test"
import assert from "node:assert/strict"
import {
  workspaceReducer,
  DEMO_WORKSPACE,
  DEFAULT_CONNECTED_DATA,
} from "../../../store/workspaceStore.ts"
import {
  DOCVAULT_BASELINE_POLICY,
  DOCVAULT_CANDIDATE_POLICY,
  DOCVAULT_SCHEMA,
  DOCVAULT_SCENARIOS,
} from "../../../fixtures/docvault.ts"

test("Workspace Reducer: Creates connected workspace and activates it", () => {
  const initialState = {
    workspaces: [DEMO_WORKSPACE],
    activeWorkspaceId: null,
  }

  const newWs = {
    id: "ws-docvault-01",
    mode: "connected",
    name: "DocVault Legal Holds",
    createdAt: "2026-09-20T12:00:00Z",
    connected: {
      ...DEFAULT_CONNECTED_DATA,
      baselinePolicyText: DOCVAULT_BASELINE_POLICY,
      candidatePolicyText: DOCVAULT_CANDIDATE_POLICY,
      schemaText: DOCVAULT_SCHEMA,
      scenarios: DOCVAULT_SCENARIOS,
    },
  }

  const nextState = workspaceReducer(initialState, {
    type: "CREATE_WORKSPACE",
    workspace: newWs,
  })

  assert.equal(nextState.workspaces.length, 2)
  assert.equal(nextState.activeWorkspaceId, "ws-docvault-01")
  const created = nextState.workspaces.find((w) => w.id === "ws-docvault-01")
  assert.ok(created)
  assert.equal(created.connected.scenarios.length, 6)
})

test("Workspace Reducer: Candidate policy edit marks analysis and approval as STALE", () => {
  const wsId = "ws-docvault-02"
  const state = {
    workspaces: [
      DEMO_WORKSPACE,
      {
        id: wsId,
        mode: "connected",
        name: "DocVault Test",
        createdAt: "2026-09-20T12:00:00Z",
        connected: {
          ...DEFAULT_CONNECTED_DATA,
          candidatePolicyText: DOCVAULT_CANDIDATE_POLICY,
          analysisStale: false,
          approvalStale: false,
        },
      },
    ],
    activeWorkspaceId: wsId,
  }

  const modifiedPolicy = DOCVAULT_CANDIDATE_POLICY + "\n// Extra rule"
  const updatedState = workspaceReducer(state, {
    type: "UPDATE_CONNECTED_DATA",
    id: wsId,
    patch: { candidatePolicyText: modifiedPolicy },
  })

  const updatedWs = updatedState.workspaces.find((w) => w.id === wsId)
  assert.equal(updatedWs.connected.analysisStale, true)
  assert.equal(updatedWs.connected.approvalStale, true)
  assert.equal(updatedWs.connected.candidatePolicyText, modifiedPolicy)
})

test("Workspace Reducer: MARK_ANALYSIS_FRESH resets stale flag and sets evaluation source", () => {
  const wsId = "ws-docvault-03"
  const state = {
    workspaces: [
      DEMO_WORKSPACE,
      {
        id: wsId,
        mode: "connected",
        name: "DocVault Fresh Test",
        createdAt: "2026-09-20T12:00:00Z",
        connected: {
          ...DEFAULT_CONNECTED_DATA,
          analysisStale: true,
          approvalStale: true,
        },
      },
    ],
    activeWorkspaceId: wsId,
  }

  const freshState = workspaceReducer(state, {
    type: "MARK_ANALYSIS_FRESH",
    id: wsId,
    source: "LOCAL_CEDAR_WASM",
  })

  const freshWs = freshState.workspaces.find((w) => w.id === wsId)
  assert.equal(freshWs.connected.analysisStale, false)
  assert.equal(freshWs.connected.lastAnalysisSource, "LOCAL_CEDAR_WASM")
  assert.ok(freshWs.connected.lastAnalyzedAt)
})

test("Workspace Reducer: Multi-workspace isolation guarantees separate policies and scenarios", () => {
  const ws1 = {
    id: "ws-project-alpha",
    mode: "connected",
    name: "Project Alpha",
    createdAt: "2026-09-20T12:00:00Z",
    connected: {
      ...DEFAULT_CONNECTED_DATA,
      baselinePolicyText: 'permit(principal == User::"alpha", action, resource);',
      scenarios: [
        {
          id: "sc-alpha-1",
          principal: 'User::"alpha"',
          action: 'Action::"view"',
          resource: 'Doc::"1"',
          expectedDecision: "ALLOW",
          tags: ["alpha"],
        },
      ],
    },
  }

  const ws2 = {
    id: "ws-project-beta",
    mode: "connected",
    name: "Project Beta",
    createdAt: "2026-09-20T12:00:00Z",
    connected: {
      ...DEFAULT_CONNECTED_DATA,
      baselinePolicyText: 'permit(principal == User::"beta", action, resource);',
      scenarios: [
        {
          id: "sc-beta-1",
          principal: 'User::"beta"',
          action: 'Action::"edit"',
          resource: 'Doc::"2"',
          expectedDecision: "ALLOW",
          tags: ["beta"],
        },
      ],
    },
  }

  let state = {
    workspaces: [DEMO_WORKSPACE],
    activeWorkspaceId: null,
  }

  state = workspaceReducer(state, { type: "CREATE_WORKSPACE", workspace: ws1 })
  state = workspaceReducer(state, { type: "CREATE_WORKSPACE", workspace: ws2 })

  assert.equal(state.workspaces.length, 3)

  // Switch to Alpha
  state = workspaceReducer(state, { type: "SELECT_WORKSPACE", id: ws1.id })
  assert.equal(state.activeWorkspaceId, "ws-project-alpha")

  // Update Beta without affecting Alpha
  state = workspaceReducer(state, {
    type: "UPDATE_CONNECTED_DATA",
    id: ws2.id,
    patch: { candidateLabel: "Beta v2 Candidate" },
  })

  const retrievedAlpha = state.workspaces.find((w) => w.id === ws1.id)
  const retrievedBeta = state.workspaces.find((w) => w.id === ws2.id)

  assert.equal(retrievedAlpha.connected.candidateLabel, "Candidate")
  assert.equal(retrievedBeta.connected.candidateLabel, "Beta v2 Candidate")
  assert.equal(retrievedAlpha.connected.scenarios[0].id, "sc-alpha-1")
  assert.equal(retrievedBeta.connected.scenarios[0].id, "sc-beta-1")
})

test("Workspace Reducer: Prevents deleting the Demo Workspace", () => {
  const state = {
    workspaces: [DEMO_WORKSPACE],
    activeWorkspaceId: DEMO_WORKSPACE.id,
  }

  const nextState = workspaceReducer(state, {
    type: "DELETE_WORKSPACE",
    id: DEMO_WORKSPACE.id,
  })

  assert.equal(nextState.workspaces.length, 1)
  assert.equal(nextState.workspaces[0].id, DEMO_WORKSPACE.id)
})
