// AcmePay Core Authorization Policy Set — Candidate Version 13 (Corrected / Verified)
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
