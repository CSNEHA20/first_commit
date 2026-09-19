// AcmePay Restricted Policy Set (Used to test NEWLY_FORBIDDEN transitions)
// Removed contractor support ticket viewing privileges and added explicit contractor forbid.

// 1. Admin Full Access
permit (
    principal in Role::"admin",
    action,
    resource
);

// 2. Finance Managers manage invoices only (removed payroll export)
permit (
    principal in Role::"finance_manager",
    action in [Action::"view", Action::"edit"],
    resource is Invoice
);

// 3. Editors read-only (removed edit invoice, producing NEWLY_FORBIDDEN on edit)
permit (
    principal in Role::"editor",
    action == Action::"view",
    resource is Invoice
);

// 4. Contractors: Revoked support ticket viewing (producing NEWLY_FORBIDDEN)
// No permit for contractor

// 5. Explicit Forbid: Non-admins cannot delete Payroll Reports
forbid (
    principal,
    action == Action::"delete",
    resource is PayrollReport
)
unless {
    principal in Role::"admin"
};
