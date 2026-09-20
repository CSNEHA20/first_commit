// DocVault Baseline Authorization Policy (v1.0 Production)
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
);
