// DocVault Candidate Authorization Policy (v1.1 Fixed / Verified)
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
);
