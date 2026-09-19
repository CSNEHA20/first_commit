// AcmePay Core Authorization Policy Set — Candidate Version 13
// Intended change: Broaden editor actions to include invoice deletion.
// Accidental regressions:
// 1. Broadened editor action permissions (permit editor delete invoice).
// 2. Broadened contractor action permissions on support tickets (permit contractor all actions).
// 3. Contractor delete payroll remains forbidden by policy4.

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

// 3. Editors read, modify, and DELETE invoices (Introduces NEWLY_AUTHORIZED regression on delete)
permit (
    principal in Role::"editor",
    action in [Action::"view", Action::"edit", Action::"delete"],
    resource is Invoice
);

// 4. Contractors broadened action on support tickets (Introduces NEWLY_AUTHORIZED on delete ticket)
permit (
    principal in Role::"contractor",
    action,
    resource is SupportTicket
);

// 5. Explicit Forbid: Non-admins cannot delete Payroll Reports (UNCHANGED_DENY via forbid)
forbid (
    principal,
    action == Action::"delete",
    resource is PayrollReport
)
unless {
    principal in Role::"admin"
};
