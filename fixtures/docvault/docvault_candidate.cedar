// DocVault Candidate Authorization Policy (v1.1 Draft - Contains Flaw)
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
);
