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

export interface AIExplanationRequest {
  baselineDecision?: AuthorizationDecision | null
  candidateDecision?: AuthorizationDecision | null
  transition?: string | null
  scenarioId?: string | null
  scenarioTitle?: string | null
  principal?: string | null
  action?: string | null
  resource?: string | null
  context?: Record<string, unknown>
  violatedContractId?: string | null
  violatedContractTitle?: string | null
  counterexampleId?: string | null
  matchedPolicyId?: string | null
  baselineDeterminingPolicies?: string[]
  candidateDeterminingPolicies?: string[]
  baselineDiagnostics?: { errors: string[]; warnings: string[] }
  candidateDiagnostics?: { errors: string[]; warnings: string[] }
  reproduced?: boolean | null
  mismatchReason?: string | null
  regressionGateStatus?: string | null
  regressionGateReasons?: string[]
  policyExcerpt?: string | null
  providerPreference?: "BEDROCK" | "LOCAL_FALLBACK" | "AUTO"
}

export interface AIExplanationResponse {
  findingId?: string
  summary: string
  observedTransition?: string
  rootCause: string
  securityImpact?: string
  securityRisk?: string
  remediationSuggestion?: string | null
  remediationCedar?: string | null
  evidenceCitations?: string[]
  evidenceReferences?: string[]
  limitations?: string[] | string
  isFactGrounded?: boolean
  isDeterministicFallback?: boolean
  providerUsed?: string
  provider?: string
  modelId?: string | null
  isFallback?: boolean
  generatedAt?: string
}

export interface AVPReadinessResponse {
  isConfigured: boolean
  isReadyForDeployment: boolean
  awsRegion?: string | null
  configuredPolicyStores: Record<string, string>
  adapterMode: "LIVE_BOTO3" | "DETERMINISTIC_FAKE"
  missingRequirements: string[]
  checklist: Array<{ item: string; satisfied: boolean; description: string }>
}

export interface DeploymentPrepareRequest {
  candidatePolicyText: string
  schemaText?: string
  targetEnv: "staging" | "production"
  regressionReport: RegressionReport
}

export interface DeploymentPrepareResponse {
  isDeployable: boolean
  targetEnv: string
  targetPolicyStoreId: string
  candidatePolicyHashSha256: string
  regressionGateStatus: string
  rejectionReasons: string[]
  requiresHumanApproval: boolean
  approvalTokenRequired: boolean
}

export interface HumanApprovalRequest {
  candidatePolicyHashSha256: string
  targetEnv: "staging" | "production"
  approverName: string
  approverEmail?: string | null
  ticketReference?: string | null
  approvalNotes?: string | null
}

export interface HumanApprovalResponse {
  isApproved: boolean
  approvalToken: string
  candidatePolicyHashSha256: string
  targetEnv: string
  approverName: string
  approvedAt: string
  expiresAt: string
}

export interface DeploymentSubmitRequest {
  candidatePolicyText: string
  schemaText?: string
  targetEnv: "staging" | "production"
  approvalToken: string
  regressionRunId: string
  candidateLabel?: string
}

export interface DeploymentSubmitResponse {
  deploymentId: string
  status: "SUBMITTED" | "VERIFIED_REMOTELY" | "REJECTED" | "FAILED"
  targetEnv: string
  targetPolicyStoreId: string
  candidatePolicyHashSha256: string
  deployedAt: string
  deployedBy: string
  verificationProof: string
  remoteVerified: boolean
  details?: string | null
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
  policyVersionId?: string
  versionTag: string
  policyHash: string
  targetStoreId: string
  environment: "staging" | "production"
  status: "SYNCHRONIZED" | "BLOCKED" | "PENDING" | "SUBMITTED" | "VERIFIED_REMOTELY"
  deployedBy: string
  deployedAt: string
  verificationProof: string
}

export interface ToolInvocation {
  tool: string
  target?: string
  success?: boolean
  timestamp?: string
  runId?: string
  gateStatus?: string
  findingId?: string
  provider?: string
  [key: string]: unknown
}

export interface AuditWorkflowReport {
  auditRunId: string
  timestamp: string
  agentIdentity: string
  status: "COMPLETED_PASS" | "COMPLETED_BLOCKED" | "VALIDATION_FAILED" | "EXECUTION_ERROR"
  gateDecision: "PASS" | "BLOCKED" | "INCOMPLETE"
  summary: string
  validationReport: {
    candidateValid?: boolean
    baselineValid?: boolean
    errors?: string[]
    warnings?: string[]
  }
  diffReport?: any
  counterexamples: Counterexample[]
  contractResults: Array<{
    contract: SecurityContract
    status: "SATISFIED" | "VIOLATED" | "SKIPPED"
    violatingScenarioIds?: string[]
    [key: string]: unknown
  }>
  regressionReport?: unknown
  aiExplanations: AIExplanationResponse[]
  toolInvocations: ToolInvocation[]
  evidenceLedger: {
    auditId?: string
    regressionRunId?: string
    gateDecision?: string
    reasons?: string[]
    [key: string]: unknown
  }
}

export interface ScenarioSuite {
  id: string
  name: string
  description?: string
  version?: string
  scenarios: Scenario[]
}

export interface AgentAuditRequest {
  baselinePolicyText: string
  candidatePolicyText: string
  suite: ScenarioSuite
  contracts?: SecurityContract[]
  schemaText?: string
  entities?: Array<Record<string, unknown>>
  baselineLabel?: string
  candidateLabel?: string
  runAiExplanation?: boolean
}

export interface AsyncAuditStartResponse {
  executionArn: string
  startDate: string
  status: string
  stateMachineArn: string
  message: string
}

export interface AsyncAuditStatusResponse {
  executionArn: string
  status: string
  startDate?: string | null
  stopDate?: string | null
  output?: Record<string, unknown> | null
  error?: string | null
  cause?: string | null
}

