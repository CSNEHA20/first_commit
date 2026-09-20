/**
 * DocVault Non-AcmePay Cedar Authorization Fixture
 * Provides an independent, real-world authorization benchmark for Enterprise Document Vault & Legal Holds.
 */

import type { Scenario, ScenarioSuite, SecurityContract } from "../types/authz.ts"

export const DOCVAULT_BASELINE_POLICY = `// DocVault Baseline Authorization Policy (v1.0 Production)
// Domain: Enterprise Document Vault & Legal Hold System

// 1. Legal Counsel has full access to all legal matters
permit (
    principal in DocVault::Role::"legal_counsel",
    action,
    resource
);

// 2. Compliance Officers can view and export non-restricted compliance filings
permit (
    principal in DocVault::Role::"compliance_officer",
    action in [DocVault::Action::"view", DocVault::Action::"export"],
    resource
)
when {
    resource.classification != "RESTRICTED_LITIGATION"
};

// 3. External Auditors can view audit logs and standard policies
permit (
    principal in DocVault::Role::"external_auditor",
    action == DocVault::Action::"view",
    resource is DocVault::AuditRecord
);

// 4. Strict Forbid: External Auditors cannot export any work product
forbid (
    principal in DocVault::Role::"external_auditor",
    action == DocVault::Action::"export",
    resource
);`

export const DOCVAULT_CANDIDATE_POLICY = `// DocVault Candidate Authorization Policy (v1.1 Draft - Contains Flaw)
// Domain: Enterprise Document Vault & Legal Hold System
// FLAW: Action wildcard expansion incorrectly permits external auditor export

// 1. Legal Counsel has full access to all legal matters
permit (
    principal in DocVault::Role::"legal_counsel",
    action,
    resource
);

// 2. Compliance Officers can view and export non-restricted compliance filings
permit (
    principal in DocVault::Role::"compliance_officer",
    action in [DocVault::Action::"view", DocVault::Action::"export"],
    resource
)
when {
    resource.classification != "RESTRICTED_LITIGATION"
};

// 3. Flawed rule: Broadened action scope for external auditor without forbid override
permit (
    principal in DocVault::Role::"external_auditor",
    action in [DocVault::Action::"view", DocVault::Action::"export"],
    resource is DocVault::AuditRecord
);`

export const DOCVAULT_FIXED_POLICY = `// DocVault Candidate Authorization Policy (v1.1 Fixed / Verified)
// Domain: Enterprise Document Vault & Legal Hold System

// 1. Legal Counsel has full access to all legal matters
permit (
    principal in DocVault::Role::"legal_counsel",
    action,
    resource
);

// 2. Compliance Officers can view and export non-restricted compliance filings
permit (
    principal in DocVault::Role::"compliance_officer",
    action in [DocVault::Action::"view", DocVault::Action::"export"],
    resource
)
when {
    resource.classification != "RESTRICTED_LITIGATION"
};

// 3. Fixed rule: External auditors restricted strictly to viewing audit records
permit (
    principal in DocVault::Role::"external_auditor",
    action == DocVault::Action::"view",
    resource is DocVault::AuditRecord
);

// 4. Defense-in-depth forbid: External auditors cannot export any records
forbid (
    principal in DocVault::Role::"external_auditor",
    action == DocVault::Action::"export",
    resource
);`

export const DOCVAULT_SCHEMA = JSON.stringify({
  "DocVault": {
    "entityTypes": {
      "User": { "memberOfTypes": ["Role"] },
      "Role": { "memberOfTypes": [] },
      "Document": {
        "shape": {
          "type": "Record",
          "attributes": {
            "classification": { "type": "String", "required": true },
            "matterId": { "type": "String", "required": false }
          }
        }
      },
      "AuditRecord": {
        "shape": {
          "type": "Record",
          "attributes": {
            "classification": { "type": "String", "required": true }
          }
        }
      }
    },
    "actions": {
      "view": {
        "appliesTo": {
          "principalTypes": ["User"],
          "resourceTypes": ["Document", "AuditRecord"]
        }
      },
      "edit": {
        "appliesTo": {
          "principalTypes": ["User"],
          "resourceTypes": ["Document"]
        }
      },
      "export": {
        "appliesTo": {
          "principalTypes": ["User"],
          "resourceTypes": ["Document", "AuditRecord"]
        }
      },
      "delete": {
        "appliesTo": {
          "principalTypes": ["User"],
          "resourceTypes": ["Document"]
        }
      }
    }
  }
}, null, 2)

export const DOCVAULT_ENTITIES = [
  {
    uid: { type: "DocVault::Role", id: "legal_counsel" },
    attrs: {},
    parents: []
  },
  {
    uid: { type: "DocVault::Role", id: "compliance_officer" },
    attrs: {},
    parents: []
  },
  {
    uid: { type: "DocVault::Role", id: "external_auditor" },
    attrs: {},
    parents: []
  },
  {
    uid: { type: "DocVault::User", id: "attorney_elena" },
    attrs: {},
    parents: [{ type: "DocVault::Role", id: "legal_counsel" }]
  },
  {
    uid: { type: "DocVault::User", id: "compliance_marcus" },
    attrs: {},
    parents: [{ type: "DocVault::Role", id: "compliance_officer" }]
  },
  {
    uid: { type: "DocVault::User", id: "auditor_dave" },
    attrs: {},
    parents: [{ type: "DocVault::Role", id: "external_auditor" }]
  },
  {
    uid: { type: "DocVault::Document", id: "litigation_hold_901" },
    attrs: {
      classification: "RESTRICTED_LITIGATION",
      matterId: "MAT-2026-09"
    },
    parents: []
  },
  {
    uid: { type: "DocVault::Document", id: "compliance_report_104" },
    attrs: {
      classification: "INTERNAL_COMPLIANCE",
      matterId: "MAT-2026-01"
    },
    parents: []
  },
  {
    uid: { type: "DocVault::AuditRecord", id: "system_access_log_q3" },
    attrs: {
      classification: "AUDIT_LOG"
    },
    parents: []
  }
]

export const DOCVAULT_SCENARIOS: Scenario[] = [
  {
    id: "sc_dv_01",
    title: "Legal Counsel Full Access to Litigation Hold",
    principal: 'DocVault::User::"attorney_elena"',
    action: 'DocVault::Action::"view"',
    resource: 'DocVault::Document::"litigation_hold_901"',
    context: {},
    expectedDecision: "ALLOW",
    tags: ["legal", "litigation", "baseline-allow"]
  },
  {
    id: "sc_dv_02",
    title: "Compliance Officer View Compliance Report",
    principal: 'DocVault::User::"compliance_marcus"',
    action: 'DocVault::Action::"view"',
    resource: 'DocVault::Document::"compliance_report_104"',
    context: {},
    expectedDecision: "ALLOW",
    tags: ["compliance", "baseline-allow"]
  },
  {
    id: "sc_dv_03",
    title: "Compliance Officer Blocked from Restricted Litigation",
    principal: 'DocVault::User::"compliance_marcus"',
    action: 'DocVault::Action::"view"',
    resource: 'DocVault::Document::"litigation_hold_901"',
    context: {},
    expectedDecision: "DENY",
    tags: ["compliance", "security-boundary"]
  },
  {
    id: "sc_dv_04",
    title: "Auditor View Audit Record",
    principal: 'DocVault::User::"auditor_dave"',
    action: 'DocVault::Action::"view"',
    resource: 'DocVault::AuditRecord::"system_access_log_q3"',
    context: {},
    expectedDecision: "ALLOW",
    tags: ["audit", "baseline-allow"]
  },
  {
    id: "sc_dv_05",
    title: "Auditor Export Audit Record (Violation in Candidate)",
    principal: 'DocVault::User::"auditor_dave"',
    action: 'DocVault::Action::"export"',
    resource: 'DocVault::AuditRecord::"system_access_log_q3"',
    context: {},
    expectedDecision: "DENY",
    tags: ["audit", "export-restriction", "contract-critical"]
  },
  {
    id: "sc_dv_06",
    title: "Auditor View Litigation Hold (Must Be Denied)",
    principal: 'DocVault::User::"auditor_dave"',
    action: 'DocVault::Action::"view"',
    resource: 'DocVault::Document::"litigation_hold_901"',
    context: {},
    expectedDecision: "DENY",
    tags: ["audit", "boundary"]
  }
]

export const DOCVAULT_SCENARIO_SUITE: ScenarioSuite = {
  id: "suite_docvault_enterprise",
  name: "DocVault Enterprise Legal & Audit Suite",
  scenarios: DOCVAULT_SCENARIOS,
}

export const DOCVAULT_CONTRACTS: SecurityContract[] = [
  {
    id: "SEC-DOC-01",
    title: "Auditor Export Restriction",
    description: "External auditors must never be permitted to export any audit records or vault documents.",
    severity: "CRITICAL",
    isBlocking: true,
    scenarioIds: ["sc_dv_05"],
    isActive: true,
    expectedDecision: "DENY"
  },
  {
    id: "SEC-DOC-02",
    title: "Litigation Hold Isolation",
    description: "Restricted litigation documents must only be accessible to Legal Counsel.",
    severity: "HIGH",
    isBlocking: true,
    scenarioIds: ["sc_dv_03", "sc_dv_06"],
    isActive: true,
    expectedDecision: "DENY"
  }
]

export const DOCVAULT_WORKSPACE = {
  id: "docvault-production",
  mode: "connected" as const,
  name: "DocVault Document Management",
  createdAt: "2026-09-19T12:00:00Z",
  connected: {
    baselinePolicyText: DOCVAULT_BASELINE_POLICY,
    baselineLabel: "DocVault v1.0 (Production)",
    candidatePolicyText: DOCVAULT_CANDIDATE_POLICY,
    candidateLabel: "DocVault v1.1 (Draft)",
    schemaText: DOCVAULT_SCHEMA,
    entitiesJson: JSON.stringify(DOCVAULT_ENTITIES, null, 2),
    scenarios: DOCVAULT_SCENARIOS,
    contracts: DOCVAULT_CONTRACTS,
    importSource: "LOCAL_CLI" as const,
    sourceRef: "fixtures/docvault",
    analysisStale: false,
    approvalStale: false,
    lastAnalyzedAt: null,
    lastAnalysisSource: null,
  },
}
