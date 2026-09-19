// Valid AcmePay Cedar Policy Set
// Fixture for deterministic test execution

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
    resource
)
when {
    resource is Invoice || resource is PayrollReport
};

// 3. Editors read and modify invoices
permit (
    principal in Role::"editor",
    action in [Action::"view", Action::"edit"],
    resource is Invoice
);

// 4. Contractors strictly read-only for assigned support tickets
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
