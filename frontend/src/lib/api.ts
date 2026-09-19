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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

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
  const res = await fetch(`${API_BASE_URL}/policies/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/simulate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/policies/diff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/policies/counterexamples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/counterexamples/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/contracts/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/policies/regression`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorBody.detail || "Regression evaluation failed")
  }
  return res.json()
}
