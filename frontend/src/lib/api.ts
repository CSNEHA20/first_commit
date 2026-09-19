/**
 * PolicyLab Frontend API Client
 * Interfaces with FastAPI deterministic Cedar backend.
 */

import {
  AuthorizationRequest,
  CanonicalEvidence,
  Scenario,
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
