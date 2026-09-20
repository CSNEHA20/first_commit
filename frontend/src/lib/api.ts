/**
 * PolicyLab Frontend API Client
 * Interfaces with FastAPI deterministic Cedar backend.
 */

import {
  AuthorizationRequest,
  CanonicalEvidence,
  Counterexample,
  CounterexampleReplayRequest,
  CounterexampleReplayResult,
  RegressionReport,
  Scenario,
  SecurityContract,
  SecurityContractResult,
} from "../types/authz"
import { getAuthToken, getStoredUser, generateLocalDevToken, setAuthToken } from "./auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

export function getAuthHeaders(): Record<string, string> {
  let token = getAuthToken()
  if (!token) {
    const user = getStoredUser()
    token = generateLocalDevToken(user)
    setAuthToken(token)
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export interface PolicyValidationResponse {
  isValid: boolean
  errors: Array<{
    message: string
    help?: string | null
    code?: string | null
    severity: string
    sourceLocations: Array<{ start: number; end: number; label?: string | null }>
  }>
  warnings: Array<{
    message: string
    help?: string | null
    code?: string | null
    severity: string
  }>
  engine: string
}

export interface ScenarioResult {
  scenarioId: string
  scenarioTitle?: string | null
  status: "SUCCESS" | "EXECUTION_ERROR"
  decision?: "ALLOW" | "DENY" | null
  expectedDecision?: "ALLOW" | "DENY" | null
  isExpected?: boolean | null
  determiningPolicies: string[]
  matchedPolicies: Array<{
    policyId: string
    effect: "permit" | "forbid"
    clause: string
    lineNumber?: number
  }>
  diagnostics: {
    errors: string[]
    warnings: string[]
  }
  executionDurationMs: number
  error?: string | null
}

export interface SimulationRunResponse {
  runId: string
  suiteId: string
  suiteName: string
  status: "COMPLETED" | "PARTIAL_FAILURE" | "FAILED"
  totalScenarios: number
  successCount: number
  errorCount: number
  allowCount: number
  denyCount: number
  passedExpectationsCount: number
  failedExpectationsCount: number
  executionDurationMs: number
  timestamp: string
  engine: string
  results: ScenarioResult[]
}

export type BehavioralTransition =
  | "UNCHANGED_ALLOW"
  | "UNCHANGED_DENY"
  | "NEWLY_FORBIDDEN"
  | "NEWLY_AUTHORIZED"

export interface ScenarioDiffResult {
  scenarioId: string
  scenarioTitle?: string | null
  principal: string
  action: string
  resource: string
  context: Record<string, unknown>
  status: "COMPARABLE" | "UNCOMPARABLE"
  transition?: BehavioralTransition | null
  baselineDecision?: "ALLOW" | "DENY" | null
  candidateDecision?: "ALLOW" | "DENY" | null
  baselineDeterminingPolicies: string[]
  candidateDeterminingPolicies: string[]
  baselineDiagnostics: { errors: string[]; warnings: string[] }
  candidateDiagnostics: { errors: string[]; warnings: string[] }
  error?: string | null
}

export interface BoundedImpactSummary {
  totalScenariosDeclared: number
  totalScenariosCompared: number
  uncomparableScenariosCount: number
  unchangedAllowCount: number
  unchangedDenyCount: number
  newlyForbiddenCount: number
  newlyAuthorizedCount: number
  baselineExecutionErrorsCount: number
  candidateExecutionErrorsCount: number
  comparisonCoveragePct: number
  newlyForbiddenRatePct: number
  newlyAuthorizedRatePct: number
  unchangedRatePct: number
  deltaPrincipals: number
  deltaActions: number
  deltaResources: number
  affectedPrincipals: string[]
  affectedActions: string[]
  affectedResources: string[]
  isBoundedUniverse: boolean
  boundaryStatement: string
}

export interface PolicyDiffReport {
  reportId: string
  timestamp: string
  engine: string
  baselineLabel: string
  candidateLabel: string
  impactSummary: BoundedImpactSummary
  scenarioDiffs: ScenarioDiffResult[]
  newlyAuthorizedScenarios: ScenarioDiffResult[]
  newlyForbiddenScenarios: ScenarioDiffResult[]
}

export interface ContractEvaluationReport {
  reportId: string
  timestamp: string
  totalContracts: number
  passedContracts: number
  failedContracts: number
  uncomparableContracts: number
  errorContracts: number
  allBlockingPassed: boolean
  results: SecurityContractResult[]
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    throw new Error("Authentication required (HTTP 401): Missing, invalid, or expired session credentials.")
  }
  if (res.status === 403) {
    throw new Error("Access forbidden (HTTP 403): Your assigned role lacks permission for this action.")
  }
  return res
}

export async function checkBackendHealth(): Promise<{
  status: string
  engine: string
  cedarVersion: string
  cedarLangVersion: string
}> {
  const res = await fetch(`${API_BASE_URL}/health`)
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`)
  }
  return res.json()
}

export async function validateCedarPolicy(
  policyText: string,
  schemaText?: string
): Promise<PolicyValidationResponse> {
  const res = await fetchWithAuth("/policies/validate", {
    method: "POST",
    body: JSON.stringify({ policyText, schemaText }),
  })
  if (!res.ok) {
    throw new Error(`Validation request failed: ${res.statusText}`)
  }
  return res.json()
}

export async function simulateSingleAuthorization(
  request: AuthorizationRequest
): Promise<CanonicalEvidence> {
  const res = await fetchWithAuth("/simulate", {
    method: "POST",
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Simulation failed")
  }
  return res.json()
}

export async function simulateBatchScenarios(payload: {
  policyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  suite: {
    id: string
    name: string
    description?: string
    version?: string
    scenarios: Scenario[]
  }
}): Promise<SimulationRunResponse> {
  const res = await fetchWithAuth("/simulate/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Batch simulation failed")
  }
  return res.json()
}

export async function comparePolicies(payload: {
  baselinePolicyText: string
  candidatePolicyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  suite: {
    id: string
    name: string
    description?: string
    version?: string
    scenarios: Scenario[]
  }
  baselineLabel?: string
  candidateLabel?: string
}): Promise<PolicyDiffReport> {
  const res = await fetchWithAuth("/policies/diff", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Policy diff comparison failed")
  }
  return res.json()
}

export async function generateCounterexamples(payload: {
  baselinePolicyText: string
  candidatePolicyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  suite: {
    id: string
    name: string
    description?: string
    version?: string
    scenarios: Scenario[]
  }
  baselineLabel?: string
  candidateLabel?: string
}): Promise<Counterexample[]> {
  const res = await fetchWithAuth("/policies/counterexamples", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Counterexample generation failed")
  }
  return res.json()
}

export async function replayCounterexample(
  payload: CounterexampleReplayRequest
): Promise<CounterexampleReplayResult> {
  const res = await fetchWithAuth("/counterexamples/replay", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Counterexample replay failed")
  }
  return res.json()
}

export async function evaluateContracts(payload: {
  policyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  suite: {
    id: string
    name: string
    description?: string
    version?: string
    scenarios: Scenario[]
  }
  contracts: SecurityContract[]
}): Promise<ContractEvaluationReport> {
  const res = await fetchWithAuth("/contracts/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Contract evaluation failed")
  }
  return res.json()
}

export async function runRegression(payload: {
  baselinePolicyText: string
  candidatePolicyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  suite: {
    id: string
    name: string
    description?: string
    version?: string
    scenarios: Scenario[]
  }
  contracts: SecurityContract[]
  baselineLabel?: string
  candidateLabel?: string
}): Promise<RegressionReport> {
  const res = await fetchWithAuth("/policies/regression", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Regression evaluation failed")
  }
  return res.json()
}

export async function explainAuthorizationFinding(
  payload: import("../types/authz").AIExplanationRequest
): Promise<import("../types/authz").AIExplanationResponse> {
  const res = await fetchWithAuth("/explanations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "AI explanation generation failed")
  }
  return res.json()
}

export async function getAVPReadiness(): Promise<import("../types/authz").AVPReadinessResponse> {
  const res = await fetchWithAuth("/deployment/readiness")
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Failed to check AVP readiness")
  }
  return res.json()
}

export async function prepareDeployment(
  payload: import("../types/authz").DeploymentPrepareRequest
): Promise<import("../types/authz").DeploymentPrepareResponse> {
  const res = await fetchWithAuth("/deployment/prepare", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Deployment preparation failed")
  }
  return res.json()
}

export async function approveDeployment(
  payload: import("../types/authz").HumanApprovalRequest
): Promise<import("../types/authz").HumanApprovalResponse> {
  const res = await fetchWithAuth("/deployment/approve", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Human approval registration failed")
  }
  return res.json()
}

export async function submitDeployment(
  payload: import("../types/authz").DeploymentSubmitRequest
): Promise<import("../types/authz").DeploymentSubmitResponse> {
  const res = await fetchWithAuth("/deployment/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Deployment submission failed")
  }
  return res.json()
}

export async function getDeploymentHistory(): Promise<import("../types/authz").DeploymentRecord[]> {
  const res = await fetchWithAuth("/deployment/history")
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Failed to fetch deployment history")
  }
  return res.json()
}

export async function runAgentAudit(
  payload: import("../types/authz").AgentAuditRequest
): Promise<import("../types/authz").AuditWorkflowReport> {
  const res = await fetchWithAuth("/audits/agent-run", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Strands Agent audit orchestration failed")
  }
  return res.json()
}

export async function exportAuditReport(
  report: import("../types/authz").AuditWorkflowReport,
  format: "markdown" | "json" = "markdown"
): Promise<{ exportId: string; format: string; content: string; exportedAt: string }> {
  const res = await fetchWithAuth("/audits/export", {
    method: "POST",
    body: JSON.stringify({ report, format }),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Audit export failed")
  }
  return res.json()
}

export async function startAsyncAudit(
  payload: import("../types/authz").AgentAuditRequest
): Promise<import("../types/authz").AsyncAuditStartResponse> {
  const res = await fetchWithAuth("/audits/async-run", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Step Functions async audit initiation failed")
  }
  return res.json()
}

export async function getAsyncAuditStatus(
  executionArn: string
): Promise<import("../types/authz").AsyncAuditStatusResponse> {
  const encodedArn = encodeURIComponent(executionArn)
  const res = await fetchWithAuth(`/audits/executions/${encodedArn}`)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Failed to query Step Functions execution status")
  }
  return res.json()
}

export async function getAuditReport(
  auditId: string
): Promise<import("../types/authz").AuditWorkflowReport> {
  const res = await fetchWithAuth(`/audits/${encodeURIComponent(auditId)}`)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Failed to fetch audit report")
  }
  return res.json()
}


// --- Connected Workspace API -------------------------------------------------

export interface WorkspaceRecord {
  workspaceId: string
  name: string
  mode: string
  description?: string | null
  createdAt: string
  scope: 'LOCAL_SESSION'
}

export async function createWorkspace(params: { name: string; description?: string }): Promise<WorkspaceRecord> {
  const res = await fetchWithAuth('/workspaces', { method: 'POST', body: JSON.stringify({ name: params.name, description: params.description, mode: 'connected' }) })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Failed to create workspace') }
  return res.json()
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceRecord> {
  const res = await fetchWithAuth('/workspaces/' + encodeURIComponent(workspaceId))
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Workspace not found') }
  return res.json()
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  const res = await fetchWithAuth('/workspaces')
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Failed to list workspaces') }
  return res.json()
}

