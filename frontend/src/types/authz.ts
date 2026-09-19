export type AuthorizationDecision = "ALLOW" | "DENY"

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export type VersionStatus = "DRAFT" | "VALIDATED" | "ANALYZED" | "VERIFIED" | "DEPLOYED" | "BLOCKED"

export type DeploymentGateStatus = "PASS" | "BLOCKED" | "INCOMPLETE" | "READY" | "VERIFIED"

export interface AuthorizationRequest {
  principal: string
  action: string
  resource: string
  context?: Record<string, unknown>
  policyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
}

export interface MatchedPolicy {
  policyId: string
  effect: "permit" | "forbid"
  clause: string
  lineNumber?: number
}

export interface CanonicalEvidence {
  evidenceId: string
  timestamp: string
  engine: string
  evaluationMode: "DETERMINISTIC" | "SIMULATED"
  request: {
    principal: string
    action: string
    resource: string
    context: Record<string, string | number | boolean>
  }
  decision: AuthorizationDecision
  matchedPolicies: MatchedPolicy[]
  determiningPolicies: string[]
  diagnostics: {
    errors: string[]
    warnings: string[]
  }
  executionDurationMs: number
}

export interface Scenario {
  id: string
  title: string
  principal: string
  action: string
  resource: string
  context: Record<string, string | number | boolean>
  expectedDecision: AuthorizationDecision
  actualDecision?: AuthorizationDecision
  contractId?: string
  tags: string[]
  matchedPolicyId?: string
}

export interface SecurityContract {
  id: string
  title: string
  description?: string
  severity: SeverityLevel
  expectedDecision?: AuthorizationDecision
  scenarioIds: string[]
  isActive: boolean
  isBlocking?: boolean
  contractType?: "SCENARIO_SET" | "INVARIANT_DENIED" | "INVARIANT_PERMITTED"
  status?: "PASS" | "FAIL" | "UNCOMPARABLE" | "ERROR" | "PASSED" | "FAILED"
  failedCount?: number
}

export interface SecurityContractResult {
  contractId: string
  title: string
  description?: string | null
  severity: SeverityLevel
  isBlocking: boolean
  status: "PASS" | "FAIL" | "UNCOMPARABLE" | "ERROR"
  evaluatedScenariosCount: number
  passedScenariosCount: number
  failedScenariosCount: number
  uncomparableScenariosCount: number
  violatingScenarioIds: string[]
  counterexampleIds: string[]
  failureReason?: string | null
  boundaryStatement?: string
}

export interface Counterexample {
  id: string
  scenarioId: string
  scenarioTitle?: string | null
  title?: string
  principal: string
  principalRole?: string
  action: string
  resource: string
  resourceType?: string
  context: Record<string, string | number | boolean | unknown>
  baselineDecision: AuthorizationDecision
  candidateDecision: AuthorizationDecision
  transition: "NEWLY_AUTHORIZED" | "NEWLY_FORBIDDEN" | "UNCHANGED_ALLOW" | "UNCHANGED_DENY" | "DENY_TO_ALLOW" | "ALLOW_TO_DENY"
  severity?: SeverityLevel | string
  severityScore?: number
  baselineDeterminingPolicies?: string[]
  candidateDeterminingPolicies?: string[]
  matchedPolicyId?: string
  violatedContractId?: string | null
  violatedContractTitle?: string | null
  explanation?: string
  evidence?: CanonicalEvidence
}

export interface CounterexampleReplayRequest {
  counterexample: Counterexample
  baselinePolicyText: string
  candidatePolicyText: string
  schemaText?: string
  entities?: Array<Record<string, unknown>>
}

export interface CounterexampleReplayResult {
  counterexampleId: string
  scenarioId: string
  isReproduced: boolean
  recordedBaselineDecision: AuthorizationDecision
  recordedCandidateDecision: AuthorizationDecision
  replayedBaselineDecision?: AuthorizationDecision | null
  replayedCandidateDecision?: AuthorizationDecision | null
  replayedTransition?: string | null
  mismatchReason?: string | null
  baselineEvidence?: CanonicalEvidence | null
  candidateEvidence?: CanonicalEvidence | null
}

export interface RegressionGateDecision {
  status: "PASS" | "BLOCKED" | "INCOMPLETE"
  isPassing: boolean
  reasons: string[]
  blockingViolationsCount: number
  nonBlockingViolationsCount: number
  uncomparableScenariosCount: number
  executionErrorsCount: number
  requiresHumanApproval: boolean
  deploymentNotice: string
}

export interface RegressionReport {
  runId: string
  timestamp: string
  engine: string
  baselineLabel: string
  candidateLabel: string
  diffReport: any
  counterexamples: Counterexample[]
  contractResults: SecurityContractResult[]
  gateDecision: RegressionGateDecision
  boundaryStatement: string
}

export interface BlastRadiusResult {
  deltaActions: number
  deltaResources: number
  deltaPrincipals: number
  totalScenariosEvaluated: number
  newlyAuthorizedCount: number
  newlyForbiddenCount: number
  unchangedCount: number
  isBounded: boolean
  universeSize: number
  newlyAuthorized: Counterexample[]
  newlyForbidden: Counterexample[]
}

export interface PolicyVersion {
  id: string
  policySetId: string
  versionNumber: number
  versionTag: string
  parentVersionId?: string
  policyText: string
  policyHashSha256: string
  author: string
  timestamp: string
  status: VersionStatus
  changeSummary: string
  regressionPassedCount: number
  regressionTotalCount: number
}

export interface BedrockExplanation {
  findingId: string
  summary: string
  rootCause: string
  securityRisk: string
  remediationCedar: string
}

export interface AuditRun {
  id: string
  baselineVersion: string
  candidateVersion: string
  status: "BLOCKED" | "VERIFIED" | "IN_PROGRESS"
  criticalFindingsCount: number
  warningsCount: number
  contractsFailedCount: number
  contractsPassedCount: number
  counterexamplesCount: number
  aiSummary: string
  timestamp: string
}

export interface DeploymentRecord {
  id: string
  policyVersionId: string
  versionTag: string
  policyHash: string
  targetStoreId: string
  environment: "staging" | "production"
  status: "SYNCHRONIZED" | "BLOCKED" | "PENDING"
  deployedBy: string
  deployedAt: string
  verificationProof: string
}
