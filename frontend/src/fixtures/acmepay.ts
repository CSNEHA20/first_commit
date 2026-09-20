import {
  BlastRadiusResult,
  Counterexample,
  DeploymentRecord,
  PolicyVersion,
  Scenario,
  SecurityContract,
  AuditRun,
  BedrockExplanation,
} from "../types/authz"

export const ACMEPAY_SCHEMA = `{
  "AcmePay": {
    "entityTypes": {
      "User": {
        "memberOfTypes": ["Role", "Department"]
      },
      "Role": {},
      "Department": {},
      "Invoice": {
        "shape": {
          "type": "Record",
          "attributes": {
            "amount": { "type": "Long" },
            "owner": { "type": "Entity", "name": "User" },
            "department": { "type": "Entity", "name": "Department" }
          }
        }
      },
      "PayrollReport": {
        "shape": {
          "type": "Record",
          "attributes": {
            "quarter": { "type": "String" },
            "confidential": { "type": "Boolean" }
          }
        }
      },
      "CustomerRecord": {},
      "SupportTicket": {}
    },
    "actions": {
      "view": { "appliesTo": { "resourceTypes": ["Invoice", "PayrollReport", "CustomerRecord", "SupportTicket"] } },
      "edit": { "appliesTo": { "resourceTypes": ["Invoice", "SupportTicket"] } },
      "delete": { "appliesTo": { "resourceTypes": ["Invoice", "PayrollReport", "CustomerRecord", "SupportTicket"] } },
      "export": { "appliesTo": { "resourceTypes": ["Invoice", "PayrollReport", "CustomerRecord"] } }
    }
  }
}`

export const POLICY_V12_TEXT = `// AcmePay Core Authorization Policy Set — Version 12 (Production Baseline)
// Enforces least-privilege role boundaries across multi-tenant billing & payroll.

// 1. Admin Full Access
permit (
    principal in Role::"admin",
    action,
    resource
);

// 2. Finance Managers manage invoices and payroll
permit (
    principal in Role::"finance_manager",
    action in [Action::"view", Action::"edit", Action::"export"],
    resource in [ResourceType::"Invoice", ResourceType::"PayrollReport"]
);

// 3. Editors read and modify invoices in their department
permit (
    principal in Role::"editor",
    action in [Action::"view", Action::"edit"],
    resource in ResourceType::"Invoice"
);

// 4. Contractors strictly read-only for assigned support tickets
permit (
    principal in Role::"contractor",
    action == Action::"view",
    resource in ResourceType::"SupportTicket"
);

// 5. Explicit Forbid: Non-admins cannot delete Payroll Reports
forbid (
    principal,
    action == Action::"delete",
    resource in ResourceType::"PayrollReport"
)
unless {
    principal in Role::"admin"
};
`

export const POLICY_V13_TEXT = `// AcmePay Core Authorization Policy Set — Version 13 (Proposed Candidate)
// Intended: Allow editors to manage invoices more easily.
// Accidental Bug: Broadened action clause on line 18 matching all 4 actions.

// 1. Admin Full Access
permit (
    principal in Role::"admin",
    action,
    resource
);

// 2. Finance Managers manage invoices and payroll
permit (
    principal in Role::"finance_manager",
    action in [Action::"view", Action::"edit", Action::"export"],
    resource in [ResourceType::"Invoice", ResourceType::"PayrollReport"]
);

// 3. Editors: Accidental clause broadening (omitted action restriction)
permit (
    principal in Role::"editor",
    action, // ⚠ REGRESSION: Matches view, edit, delete, and export
    resource in ResourceType::"Invoice"
);

// 4. Contractors broadened through shared role inheritance clause
permit (
    principal in Role::"contractor",
    action, // ⚠ REGRESSION: Expanded across all resource types
    resource in ResourceType::"SupportTicket"
);

// 5. Explicit Forbid weakened in candidate draft
forbid (
    principal in Role::"viewer",
    action == Action::"delete",
    resource in ResourceType::"PayrollReport"
);
`

export const POLICY_V13_FIXED_TEXT = `// AcmePay Core Authorization Policy Set — Candidate Version 13 (Corrected / Verified)
// Intended fix: Reverts accidental editor invoice deletion and contractor ticket broad action,
// maintaining strict role isolation while safely introducing verified updates.

// 1. Admin Full Access (UNCHANGED_ALLOW)
permit (
    principal in Role::"admin",
    action,
    resource
);

// 2. Finance Managers manage invoices and payroll
permit (
    principal in Role::"finance_manager",
    action in [Action::"view", Action::"edit", Action::"export"],
    resource
)
when {
    resource is Invoice || resource is PayrollReport
};

// 3. Editors read and modify invoices (Corrected: deletion removed)
permit (
    principal in Role::"editor",
    action in [Action::"view", Action::"edit"],
    resource is Invoice
);

// 4. Contractors strictly view assigned support tickets (Corrected: delete removed)
permit (
    principal in Role::"contractor",
    action == Action::"view",
    resource is SupportTicket
);

// 5. Explicit Forbid: Non-admins cannot delete Payroll Reports
forbid (
    principal,
    action == Action::"delete",
    resource is PayrollReport
)
unless {
    principal in Role::"admin"
};
`


export const POLICY_VERSIONS: PolicyVersion[] = [
  {
    id: "pv_012",
    policySetId: "ps_acmepay",
    versionNumber: 12,
    versionTag: "v12",
    policyText: POLICY_V12_TEXT,
    policyHashSha256: "8a3e77f09bc1d4e21a88b024419ad21590bf12019488da12b918a09f871491bc",
    author: "Vishal (Security Lead)",
    timestamp: "2026-09-18T14:30:00Z",
    status: "DEPLOYED",
    changeSummary: "Production Baseline: Enforced department-scoped invoice viewing and contractor isolation.",
    regressionPassedCount: 18,
    regressionTotalCount: 18,
  },
  {
    id: "pv_013",
    policySetId: "ps_acmepay",
    versionNumber: 13,
    versionTag: "v13",
    parentVersionId: "pv_012",
    policyText: POLICY_V13_TEXT,
    policyHashSha256: "f4219a8bc19d08e12089aa4519bc88a104921f8a7719bc4019a871024981fa12",
    author: "Alex (Developer)",
    timestamp: "2026-09-19T07:15:00Z",
    status: "BLOCKED",
    changeSummary: "Proposed: Broadened editor action permissions; introduced critical contract regressions.",
    regressionPassedCount: 17,
    regressionTotalCount: 18,
  },
]

export const TOP_COUNTEREXAMPLES: Counterexample[] = [
  {
    id: "cx_01",
    scenarioId: "sc_06",
    title: "Contractor can DELETE confidential Payroll Report",
    principal: "User::\"contractor_alice\"",
    principalRole: "contractor",
    action: "Action::\"delete\"",
    resource: "PayrollReport::\"payroll_2026_q1\"",
    resourceType: "PayrollReport",
    context: { network: "EXTERNAL", isMfaVerified: false },
    baselineDecision: "DENY",
    candidateDecision: "ALLOW",
    transition: "DENY_TO_ALLOW",
    severity: "CRITICAL",
    severityScore: 98,
    matchedPolicyId: "policy_contractor_all_actions",
    violatedContractId: "SC-04",
    violatedContractTitle: "Contractors cannot delete payroll reports",
    evidence: {
      evidenceId: "ev_8f12a9c4",
      timestamp: "2026-09-19T08:30:00Z",
      engine: "cedar-rust-native@3.1.0",
      evaluationMode: "DETERMINISTIC",
      request: {
        principal: "User::\"contractor_alice\"",
        action: "Action::\"delete\"",
        resource: "PayrollReport::\"payroll_2026_q1\"",
        context: { network: "EXTERNAL", isMfaVerified: false },
      },
      decision: "ALLOW",
      matchedPolicies: [
        {
          policyId: "policy_contractor_all_actions",
          effect: "permit",
          clause: "principal in Role::\"contractor\", action, resource in ResourceType::\"SupportTicket\"",
          lineNumber: 24,
        },
      ],
      determiningPolicies: ["policy_contractor_all_actions"],
      diagnostics: {
        errors: [],
        warnings: ["Broad action wildcard matched without conditional restriction"],
      },
      executionDurationMs: 0.94,
    },
  },
  {
    id: "cx_02",
    scenarioId: "sc_07",
    title: "Contractor can EXPORT sensitive Payroll Report",
    principal: "User::\"contractor_alice\"",
    principalRole: "contractor",
    action: "Action::\"export\"",
    resource: "PayrollReport::\"payroll_2026_q1\"",
    resourceType: "PayrollReport",
    context: { network: "EXTERNAL" },
    baselineDecision: "DENY",
    candidateDecision: "ALLOW",
    transition: "DENY_TO_ALLOW",
    severity: "HIGH",
    severityScore: 84,
    matchedPolicyId: "policy_contractor_all_actions",
    violatedContractId: "SC-05",
    violatedContractTitle: "Contractors cannot export financial records",
    evidence: {
      evidenceId: "ev_90a18f21",
      timestamp: "2026-09-19T08:30:01Z",
      engine: "cedar-rust-native@3.1.0",
      evaluationMode: "DETERMINISTIC",
      request: {
        principal: "User::\"contractor_alice\"",
        action: "Action::\"export\"",
        resource: "PayrollReport::\"payroll_2026_q1\"",
        context: { network: "EXTERNAL" },
      },
      decision: "ALLOW",
      matchedPolicies: [
        {
          policyId: "policy_contractor_all_actions",
          effect: "permit",
          clause: "principal in Role::\"contractor\", action",
          lineNumber: 24,
        },
      ],
      determiningPolicies: ["policy_contractor_all_actions"],
      diagnostics: { errors: [], warnings: [] },
      executionDurationMs: 1.12,
    },
  },
  {
    id: "cx_03",
    scenarioId: "sc_05",
    title: "Editor can DELETE production Invoice",
    principal: "User::\"editor_bob\"",
    principalRole: "editor",
    action: "Action::\"delete\"",
    resource: "Invoice::\"inv_9082\"",
    resourceType: "Invoice",
    context: { department: "Billing" },
    baselineDecision: "DENY",
    candidateDecision: "ALLOW",
    transition: "DENY_TO_ALLOW",
    severity: "HIGH",
    severityScore: 78,
    matchedPolicyId: "policy_editor_all_actions",
    violatedContractId: "SC-03",
    violatedContractTitle: "Editors cannot delete invoices",
    evidence: {
      evidenceId: "ev_77a4192b",
      timestamp: "2026-09-19T08:30:02Z",
      engine: "cedar-rust-native@3.1.0",
      evaluationMode: "DETERMINISTIC",
      request: {
        principal: "User::\"editor_bob\"",
        action: "Action::\"delete\"",
        resource: "Invoice::\"inv_9082\"",
        context: { department: "Billing" },
      },
      decision: "ALLOW",
      matchedPolicies: [
        {
          policyId: "policy_editor_all_actions",
          effect: "permit",
          clause: "principal in Role::\"editor\", action, resource in ResourceType::\"Invoice\"",
          lineNumber: 18,
        },
      ],
      determiningPolicies: ["policy_editor_all_actions"],
      diagnostics: { errors: [], warnings: [] },
      executionDurationMs: 0.88,
    },
  },
]

export const BLAST_RADIUS_RESULT: BlastRadiusResult = {
  deltaActions: 3,
  deltaResources: 184,
  deltaPrincipals: 27,
  totalScenariosEvaluated: 432,
  newlyAuthorizedCount: 38,
  newlyForbiddenCount: 0,
  unchangedCount: 394,
  isBounded: true,
  universeSize: 432,
  newlyAuthorized: TOP_COUNTEREXAMPLES,
  newlyForbidden: [],
}

export const SECURITY_CONTRACTS: SecurityContract[] = [
  {
    id: "SC-01",
    title: "Admin full operational access",
    description: "Administrators must be permitted to perform all actions across all resource classes.",
    severity: "CRITICAL",
    expectedDecision: "ALLOW",
    scenarioIds: ["sc_01", "sc_02"],
    isActive: true,
    status: "PASSED",
  },
  {
    id: "SC-02",
    title: "Editors can view and update invoices",
    description: "Editors may view and modify invoices belonging to their designated department.",
    severity: "HIGH",
    expectedDecision: "ALLOW",
    scenarioIds: ["sc_03", "sc_04"],
    isActive: true,
    status: "PASSED",
  },
  {
    id: "SC-03",
    title: "Editors cannot delete invoices",
    description: "Destructive deletion of invoice records is restricted to Admins and Finance Managers.",
    severity: "HIGH",
    expectedDecision: "DENY",
    scenarioIds: ["sc_05"],
    isActive: true,
    status: "FAILED",
    failedCount: 1,
  },
  {
    id: "SC-04",
    title: "Contractors cannot delete payroll reports",
    description: "External contractors must never possess destructive delete privileges over payroll records.",
    severity: "CRITICAL",
    expectedDecision: "DENY",
    scenarioIds: ["sc_06"],
    isActive: true,
    status: "FAILED",
    failedCount: 1,
  },
  {
    id: "SC-05",
    title: "Contractors cannot export financial records",
    description: "Bulk data export of customer records and payroll summaries is prohibited for contractors.",
    severity: "HIGH",
    expectedDecision: "DENY",
    scenarioIds: ["sc_07"],
    isActive: true,
    status: "FAILED",
    failedCount: 1,
  },
  {
    id: "SC-06",
    title: "Cross-tenant resource isolation",
    description: "Principals cannot access or operate on resources assigned to differing tenant IDs.",
    severity: "CRITICAL",
    expectedDecision: "DENY",
    scenarioIds: ["sc_08", "sc_09"],
    isActive: true,
    status: "PASSED",
  },
]

export const ALL_REGRESSION_SCENARIOS: Scenario[] = [
  {
    id: "sc_01",
    title: "Admin can delete invoices",
    principal: "User::\"admin_root\"",
    action: "Action::\"delete\"",
    resource: "Invoice::\"inv_001\"",
    context: {},
    expectedDecision: "ALLOW",
    actualDecision: "ALLOW",
    contractId: "SC-01",
    tags: ["admin", "p0"],
  },
  {
    id: "sc_02",
    title: "Admin can view payroll reports",
    principal: "User::\"admin_root\"",
    action: "Action::\"view\"",
    resource: "PayrollReport::\"q1_summary\"",
    context: {},
    expectedDecision: "ALLOW",
    actualDecision: "ALLOW",
    contractId: "SC-01",
    tags: ["admin", "payroll"],
  },
  {
    id: "sc_03",
    title: "Editor can read department invoices",
    principal: "User::\"editor_bob\"",
    action: "Action::\"view\"",
    resource: "Invoice::\"inv_9082\"",
    context: { department: "Billing" },
    expectedDecision: "ALLOW",
    actualDecision: "ALLOW",
    contractId: "SC-02",
    tags: ["editor", "invoice"],
  },
  {
    id: "sc_04",
    title: "Editor can edit department invoices",
    principal: "User::\"editor_bob\"",
    action: "Action::\"edit\"",
    resource: "Invoice::\"inv_9082\"",
    context: { department: "Billing" },
    expectedDecision: "ALLOW",
    actualDecision: "ALLOW",
    contractId: "SC-02",
    tags: ["editor", "invoice"],
  },
  {
    id: "sc_05",
    title: "Editor cannot delete invoices",
    principal: "User::\"editor_bob\"",
    action: "Action::\"delete\"",
    resource: "Invoice::\"inv_9082\"",
    context: { department: "Billing" },
    expectedDecision: "DENY",
    actualDecision: "ALLOW",
    contractId: "SC-03",
    tags: ["editor", "regression"],
    matchedPolicyId: "policy_editor_all_actions",
  },
  {
    id: "sc_06",
    title: "Contractor cannot delete payroll reports",
    principal: "User::\"contractor_alice\"",
    action: "Action::\"delete\"",
    resource: "PayrollReport::\"payroll_2026_q1\"",
    context: { network: "EXTERNAL" },
    expectedDecision: "DENY",
    actualDecision: "ALLOW",
    contractId: "SC-04",
    tags: ["contractor", "critical_regression"],
    matchedPolicyId: "policy_contractor_all_actions",
  },
  {
    id: "sc_07",
    title: "Contractor cannot export financial records",
    principal: "User::\"contractor_alice\"",
    action: "Action::\"export\"",
    resource: "PayrollReport::\"payroll_2026_q1\"",
    context: {},
    expectedDecision: "DENY",
    actualDecision: "ALLOW",
    contractId: "SC-05",
    tags: ["contractor", "regression"],
    matchedPolicyId: "policy_contractor_all_actions",
  },
  {
    id: "sc_08",
    title: "User cannot cross tenant boundaries",
    principal: "User::\"tenant_a_user\"",
    action: "Action::\"view\"",
    resource: "Invoice::\"tenant_b_invoice\"",
    context: { tenant: "A", resourceTenant: "B" },
    expectedDecision: "DENY",
    actualDecision: "DENY",
    contractId: "SC-06",
    tags: ["multi-tenant", "security"],
  },
  {
    id: "sc_09",
    title: "Contractor can view assigned tickets",
    principal: "User::\"contractor_alice\"",
    action: "Action::\"view\"",
    resource: "SupportTicket::\"ticket_102\"",
    context: {},
    expectedDecision: "ALLOW",
    actualDecision: "ALLOW",
    tags: ["support", "contractor"],
  },
]

export const BEDROCK_EXPLANATION_DATA: Record<string, BedrockExplanation> = {
  cx_01: {
    findingId: "cx_01",
    summary: "Removing specific action equality checks caused contractor privileges to match destructive operations.",
    rootCause: "In proposed policy version v13 (Line 24), replacing `action == Action::\"view\"` with a naked `action` wildcard broadened the permit scope across all 4 schema actions, overriding the default deny for Role::\"contractor\".",
    securityRisk: "External contractors could delete quarterly payroll summaries and audit trails across all departments without authorization checks or MFA verification.",
    remediationCedar: `// Restrict contractor permissions strictly to viewing support tickets:
permit (
    principal in Role::"contractor",
    action == Action::"view",
    resource in ResourceType::"SupportTicket"
);`,
  },
  cx_03: {
    findingId: "cx_03",
    summary: "Editor role unintentionally gained delete capabilities on all invoices.",
    rootCause: "On line 18 of v13, the action list was omitted in favor of the unrestricted `action` clause, granting `delete` and `export` to standard editors.",
    securityRisk: "Non-admin editors can permanently delete customer invoices, bypassing finance manager approvals.",
    remediationCedar: `permit (
    principal in Role::"editor",
    action in [Action::"view", Action::"edit"],
    resource in ResourceType::"Invoice"
);`,
  },
}

export const AUDIT_RUN_MOCK: AuditRun = {
  id: "audit_acmepay_v12_v13_001",
  baselineVersion: "v12",
  candidateVersion: "v13",
  status: "BLOCKED",
  criticalFindingsCount: 1,
  warningsCount: 2,
  contractsFailedCount: 3,
  contractsPassedCount: 3,
  counterexamplesCount: 3,
  aiSummary: "The candidate policy v13 introduces 38 newly authorized decision transitions across 27 principals. Crucially, Security Contract SC-04 ('Contractors cannot delete payroll reports') is violated. Production synchronization is blocked until these invariants are restored.",
  timestamp: "2026-09-19T08:32:00Z",
}

export const ACMEPAY_ENTITIES: Array<Record<string, unknown>> = [
  {
    uid: { type: "Role", id: "admin" },
    attrs: {},
    parents: [],
  },
  {
    uid: { type: "Role", id: "editor" },
    attrs: {},
    parents: [],
  },
  {
    uid: { type: "Role", id: "contractor" },
    attrs: {},
    parents: [],
  },
  {
    uid: { type: "Role", id: "finance_manager" },
    attrs: {},
    parents: [],
  },
  {
    uid: { type: "Role", id: "viewer" },
    attrs: {},
    parents: [],
  },
  {
    uid: { type: "User", id: "admin_root" },
    attrs: {},
    parents: [{ type: "Role", id: "admin" }],
  },
  {
    uid: { type: "User", id: "editor_bob" },
    attrs: {},
    parents: [{ type: "Role", id: "editor" }],
  },
  {
    uid: { type: "User", id: "contractor_alice" },
    attrs: {},
    parents: [{ type: "Role", id: "contractor" }],
  },
  {
    uid: { type: "User", id: "finance_manager_sarah" },
    attrs: {},
    parents: [{ type: "Role", id: "finance_manager" }],
  },
  {
    uid: { type: "User", id: "tenant_a_user" },
    attrs: {},
    parents: [{ type: "Role", id: "viewer" }],
  },
  {
    uid: { type: "Invoice", id: "inv_001" },
    attrs: { amount: 5000 },
    parents: [],
  },
  {
    uid: { type: "Invoice", id: "inv_9082" },
    attrs: { amount: 1500 },
    parents: [],
  },
  {
    uid: { type: "PayrollReport", id: "payroll_2026_q1" },
    attrs: { quarter: "Q1", confidential: true },
    parents: [],
  },
  {
    uid: { type: "SupportTicket", id: "ticket_102" },
    attrs: {},
    parents: [],
  },
]

export const DEPLOYMENT_HISTORY: DeploymentRecord[] = [
  {
    id: "dep_001",
    policyVersionId: "pv_012",
    versionTag: "v12",
    policyHash: "8a3e77f09bc1d4e21a88b024419ad21590bf12019488da12b918a09f871491bc",
    targetStoreId: "ps-acmepay-prod",
    environment: "production",
    status: "SYNCHRONIZED",
    deployedBy: "Vishal (Auto-Pipeline)",
    deployedAt: "2026-09-18T15:00:00Z",
    verificationProof: "cedar-proof-sig-990a12fbc",
  },
]

export const ACMEPAY_SCENARIO_SUITE = {
  id: "suite_acmepay_core",
  name: "AcmePay Core Authorization Suite",
  description: "Core regression and blast-radius evaluation suite for AcmePay least-privilege policies.",
  version: "1.0.0",
  scenarios: ALL_REGRESSION_SCENARIOS,
}



