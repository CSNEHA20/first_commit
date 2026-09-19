# PolicyLab — Frontend Implementation Specification

**Design System:** Dark Security / Developer Ergonomics  
**Framework:** React 18+ / TypeScript / Tailwind CSS / Monaco Editor / shadcn/ui  
**Authors:** Sneha & Vishal (VibeSync)  

---

## 1. Frontend Goals

The PolicyLab frontend must convey **precision, authority, security rigor, and developer speed**. It should look and feel like an enterprise-grade security engineering tool (akin to Linear, Snyk, or AWS CloudWatch Insights) rather than a generic AI dashboard or marketing landing page.

Key Objectives:
- **Instant Visual Comprehension:** Turn complex multi-dimensional authorization changes into immediate, intuitive visual summaries.
- **Sub-Second Feedback Loop:** Monaco-driven editor with real-time syntax checking and sub-100ms simulation previews.
- **Zero Ambiguity:** Visually separate deterministic Cedar facts from AI diagnostic commentary.

---

## 2. Design Principles

1. **Information Density with Breathing Room:** High information density designed for developers, balanced with disciplined negative space and crisp typography.
2. **Deterministic Evidence Hierarchy:** Mathematical/Cedar facts always appear above AI narratives.
3. **Restrained Color Palette:** 90% dark slate and charcoal surfaces; color is reserved for semantic security states (`ALLOW`, `DENY`, `REGRESSION`, `WARNING`).
4. **Actionable Micro-Interactions:** Hover states, drill-downs, and evidence drawers that invite exploration without cluttering the screen.

---

## 3. Visual Language

- **Theme:** Ultra-sleek Dark Mode by default.
- **Surfaces:** Layered dark neutral background tones (`#090D16`, `#0F172A`, `#1E293B`) with subtle 1px borders (`#334155`).
- **Glassmorphism:** Subtle backdrop blur (`backdrop-blur-md bg-slate-900/80`) on sticky headers and flyout drawers.
- **Accents:** Crisp cyan/indigo accents for active selections; vibrant emerald for verified states; vivid crimson for security regressions.

---

## 4. Color System

```css
:root {
  /* Surface Layers */
  --bg-app: #07090E;         /* Deepest background */
  --bg-surface: #0E131F;     /* Standard card / container surface */
  --bg-surface-elevated: #182238; /* Elevated popovers, drawers, modals */
  --bg-surface-hover: #222F4C;

  /* Borders & Dividers */
  --border-subtle: #1E293B;
  --border-muted: #334155;
  --border-active: #475569;

  /* Typography */
  --text-primary: #F8FAFC;   /* Crisp white for headings */
  --text-secondary: #94A3B8; /* Muted slate for body/labels */
  --text-tertiary: #64748B;  /* Low-priority metadata */

  /* Security States */
  --status-allow-bg: rgba(16, 185, 129, 0.12);
  --status-allow-border: #10B981;
  --status-allow-text: #34D399;

  --status-deny-bg: rgba(239, 68, 68, 0.12);
  --status-deny-border: #EF4444;
  --status-deny-text: #F87171;

  --status-warning-bg: rgba(245, 158, 11, 0.12);
  --status-warning-border: #F59E0B;
  --status-warning-text: #FBBF24;

  --status-blocked-bg: rgba(225, 29, 72, 0.15);
  --status-blocked-border: #E11D48;
  --status-blocked-text: #FB7185;

  /* AI Accent (Amazon Bedrock / Strands) */
  --ai-brand: #8B5CF6;
  --ai-brand-bg: rgba(139, 92, 246, 0.12);
  --ai-brand-border: #A78BFA;
  --ai-brand-text: #C4B5FD;
}
```

> **Accessibility Note:** Security states are never communicated by color alone. Every badge pairs color with an explicit icon (e.g., `✓ ALLOW`, `⛔ DENY`, `🔴 FAILED CONTRACT`, `⚠ WARNING`).

---

## 5. Typography

- **Headings & Body:** `Inter`, `system-ui`, `-apple-system`, sans-serif.
- **Code, Cedar Policies & Scenarios:** `JetBrains Mono`, `Fira Code`, monospace.

Scale:
- `text-2xl` (24px, font-bold) — Screen titles & hero headers.
- `text-lg` (18px, font-semibold) — Card headings & section dividers.
- `text-sm` (14px, font-medium) — Standard UI labels and primary table values.
- `text-xs` (12px, font-normal) — Metadata, timestamps, and badges.

---

## 6. Spacing System

Strict adherence to a 4px / 8px grid (`p-2`, `p-4`, `p-6`, `gap-4`, `gap-6`). Containers maintain standard 24px inner padding with 16px inter-card gaps.

---

## 7. Radius, Borders & Shadows

- **Border Radius:** `rounded-lg` (8px) for cards, dialogs, and code blocks; `rounded-md` (6px) for buttons and input fields; `rounded-full` for status pills.
- **Borders:** Crisp `1px solid var(--border-subtle)` across all cards.
- **Shadows:** Deep dark shadows (`shadow-2xl shadow-black/60`) for floating modals and drawers.

---

## 8. Motion Principles

Micro-animations must inform, not distract:
- **Duration:** 150ms–250ms for menu transitions and drawer slides.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quint).
- **State Changes:** Subtle pulse on the Hero Blast Radius badge when recalculating changes.

---

## 9. Application Shell

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⛉ POLICYLAB   [ Project: AcmePay Core ▼ ] [ Active: v12 (Production) ]    [ 🟢 Live ]  │
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│ ❖ Overview   │                                                                         │
│ ✎ Policies   │  MAIN CONTENT AREA                                                      │
│ ⚡ Simulator  │                                                                         │
│ ⚑ Changes    │                                                                         │
│ 🛡 Audit      │                                                                         │
│ 🧪 Tests      │                                                                         │
│ 🚀 Deploy    │                                                                         │
├──────────────┴─────────────────────────────────────────────────────────────────────────┤
│ Status: Connected to Amazon Verified Permissions Store `ps-acmepay-prod`               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Navigation Structure

| Item | Route | Purpose |
|---|---|---|
| **Overview** | `/` | Executive health dashboard, current version status, regression score. |
| **Policies** | `/policies` | Monaco Cedar policy editor, syntax validation, version history. |
| **Simulator** | `/simulator` | Interactive ad-hoc scenario evaluation sandbox. |
| **Changes** | `/changes` | **HERO SCREEN:** Textual diff, blast radius, counterexamples, evidence. |
| **Audit** | `/audit` | Strands-driven comprehensive audit workflow and Bedrock synthesis. |
| **Tests** | `/tests` | Security contract management and regression suite execution. |
| **Deployments**| `/deploy` | Verification checklist and Amazon Verified Permissions deployment gate. |

---

## 11. Overview Screen

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ACMEPAY-CORE-AUTHZ                                                   Version: v12 (PROD)│
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ Cedar Validation   │ Regression Suite   │ Security Contracts │ AVP Deployment Status   │
│ ✓ Valid & Synced   │ 18 / 18 Passed     │ 6 / 6 Satisfied    │ 🟢 Verified & Active    │
└────────────────────┴────────────────────┴────────────────────┴─────────────────────────┘

RECENT POLICY CHANGES & PROPOSED VERSIONS
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [v13 - Draft]  Accidental action clause broadening                 Author: Alex (2h ago)│
│ Blast Radius: +3 Actions, +184 Resources, +27 Principals                               │
│ Status: ⛔ 1 Critical Security Contract Violated               [ Inspect Change Analysis ]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Policy Editor Screen

```text
┌───────────────────────────────────────────────────────────────┬────────────────────────┐
│ POLICY SET: AcmePay-Core-Authz                        [Save]  │ POLICY IMPACT PREVIEW  │
├───────────────────────────────────────────────────────────────┤                        │
│ 1  // Allow editors to manage invoices                        │ Baseline Version       │
│ 2  permit (                                                   │ v12 (Production)       │
│ 3      principal in Role::"editor",                           │                        │
│ 4      action, // ⚠ WARNING: Unrestricted action wildcard     │ Proposed Edit          │
│ 5      resource in ResourceType::"Invoice"                    │ v13 (Draft)            │
│ 6  );                                                         │                        │
├───────────────────────────────────────────────────────────────┤ Blast Radius:          │
│ DIAGNOSTICS & VALIDATION                                      │ ⚠ High Impact Detected │
│ ⚠ Line 4: Action wildcard matches all 4 schema actions        │                        │
│ ✓ Schema: Valid against acmepay.cedarschema.json              │ [ Analyze Changes ➔ ]  │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```

---

## 13. Simulator Screen

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ AD-HOC SCENARIO SIMULATOR                                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Principal:   [ User::"contractor_alice"       ▼ ]                                      │
│ Action:      [ Action::"delete"               ▼ ]                                      │
│ Resource:    [ PayrollReport::"q1_summary"    ▼ ]                                      │
│ Context:     { "ip": "10.0.4.12", "mfa": true }                                        │
│                                                                        [ Evaluate ⚡ ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SIMULATION RESULT                                                                      │
│ Decision: ⛔ DENY                                                 Execution: 1.2ms     │
│ Determining Policies: Default Deny (No explicit permit matched)                        │
│ Matched Policies: 0                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Change Analysis Screen (HERO SCREEN)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ AUTHORIZATION CHANGE ANALYSIS                                                v12 ➔ v13 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ AUTHORIZATION BLAST RADIUS                                                          │
│ +3 Actions  |  +184 Resources  |  +27 Principals                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TEXTUAL DIFF                        │ BEHAVIORAL TRANSITIONS (38 Changed Scenarios)    │
│ 2  permit (                         │                                                  │
│ 3    principal in Role::"editor",   │ 🔴 DENY ➔ ALLOW: Contractor ➔ DELETE ➔ Invoice   │
│ 4 -  action == Action::"view",      │ 🔴 DENY ➔ ALLOW: Contractor ➔ EXPORT ➔ Payroll   │
│ 4 +  action,                        │ 🔴 DENY ➔ ALLOW: Editor ➔ DELETE ➔ Invoice       │
│ 5    resource in ResourceType::"... │ 🟢 ALLOW ➔ ALLOW: Editor ➔ VIEW ➔ Invoice        │
├─────────────────────────────────────┴──────────────────────────────────────────────────┤
│ TOP DETERMINISTIC COUNTEREXAMPLE                                                       │
│ 🔴 Principal: User::"contractor_alice" | Action: DELETE | Resource: PayrollReport::"q1"│
│ Transition: DENY (v12) ➔ ALLOW (v13)                                                   │
│ Violated Invariant: Security Contract SC-04 ("Contractors cannot delete payroll")      │
│                                                               [ Open Evidence Drawer ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Evidence Drawer

Slides out when any finding or counterexample is clicked:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ EVIDENCE & DIAGNOSTIC DRAWER                                     [✕] │
├──────────────────────────────────────────────────────────────────────┤
│ FINDING: Unauthorized Permission Expansion                           │
│ Severity: CRITICAL                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ DETERMINISTIC CEDAR EVIDENCE                                         │
│ • Principal:   User::"contractor_alice" (Role::"contractor")         │
│ • Action:      Action::"delete"                                      │
│ • Resource:    PayrollReport::"q1_summary"                           │
│ • Baseline:    ⛔ DENY                                                │
│ • Proposed:    ✓ ALLOW                                               │
│ • Matched:     Policy `policy_editor_all_actions` (Line 4)           │
│ • Contract:    SC-04 ("Contractors cannot delete payroll reports")   │
├──────────────────────────────────────────────────────────────────────┤
│ 🤖 AMAZON BEDROCK EXPLANATION                                        │
│ Root Cause:                                                          │
│ The change on line 4 removed the explicit `Action::"view"` equality  │
│ check, causing the permit statement to match all actions including   │
│ destructive operations across inherited role scopes.                 │
│                                                                      │
│ Suggested Remediation:                                               │
│ ```cedar                                                             │
│ permit (                                                             │
│     principal in Role::"editor",                                     │
│     action in [Action::"view", Action::"edit"],                      │
│     resource in ResourceType::"Invoice"                              │
│ );                                                                   │
│ ```                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 16. Audit Screen

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STRANDS POLICY AUDIT REPORT                                       Status: ⛔ BLOCKED    │
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ Critical Findings  │ Warnings           │ Contracts Failed   │ Blast Radius Score      │
│ 1 Critical         │ 2 Warnings         │ 1 / 6 Failed       │ 🔴 High Risk (+184 Rsc) │
├────────────────────┴────────────────────┴────────────────────┴─────────────────────────┤
│ AUDIT PIPELINE EXECUTION                                                               │
│ [✓] 1. Cedar Schema Validation .............................................. PASSED   │
│ [✓] 2. Semantic Matrix Diff ................................................. PASSED   │
│ [!] 3. Deterministic Counterexample Discovery ..................... 3 FINDINGS FLAGGED │
│ [✕] 4. Security Contract Verification .............................. 1 CONTRACT FAILED │
│ [✓] 5. Amazon Bedrock Evidence Synthesis .................................... COMPLETE │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Regression Screen

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SECURITY CONTRACT REGRESSION SUITE                             [ Run All Tests ⚡ ]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ✓ Admin can delete invoices .................................................. PASS   │
│ ✓ Editor can view department invoices ........................................ PASS   │
│ ✓ Editor cannot delete invoices .............................................. PASS   │
│ 🔴 Contractor cannot delete payroll reports .................................. FAIL    │
│    Expected: DENY | Actual: ALLOW (Matched: Policy P-04)                              │
│ ✓ Cross-tenant resource access blocked ....................................... PASS   │
│ ✓ Support agent cannot export customer records ............................... PASS   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Summary: 5 Passed, 1 Failed                                 Duration: 14ms             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Deployment Screen

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DEPLOYMENT READINESS GATE                                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Target Store: Amazon Verified Permissions (`ps-acmepay-prod`)                          │
│ Candidate Version: v13 (Hash: 8a3e77f...91bc)                                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PRE-DEPLOYMENT VERIFICATION CHECKLIST                                                  │
│ [✓] Syntax & Schema Validation ............................................. PASSED    │
│ [✓] Behavioral Diff Computed ............................................... PASSED    │
│ [✕] Security Contract Regression Suite ..................................... 1 FAILED  │
│ [✕] Unresolved Critical Counterexamples ................................... 1 ACTIVE  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ DEPLOYMENT STATUS: ⛔ BLOCKED                                                          │
│ Production deployment is restricted while critical security invariants are failing.   │
│                                                                                        │
│ [ 🔒 Deploy to Amazon Verified Permissions (Disabled) ]                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 19. Reusable Component Architecture

```text
frontend/src/
├── components/
│   ├── layout/
│   │   ├── AppHeader.tsx
│   │   ├── AppSidebar.tsx
│   │   └── PageContainer.tsx
│   ├── editor/
│   │   ├── CedarMonacoEditor.tsx
│   │   └── DiagnosticBar.tsx
│   ├── diff/
│   │   ├── TextDiffViewer.tsx
│   │   └── BehavioralMatrix.tsx
│   ├── blast-radius/
│   │   ├── BlastRadiusHeroCard.tsx
│   │   └── NewlyAuthorizedList.tsx
│   ├── evidence/
│   │   ├── EvidenceDrawer.tsx
│   │   ├── CedarFactCard.tsx
│   │   └── BedrockExplanationCard.tsx
│   ├── regression/
│   │   ├── ContractRow.tsx
│   │   └── TestRunnerHeader.tsx
│   ├── deployment/
│   │   └── DeploymentGateChecklist.tsx
│   └── primitives/
│       ├── Badge.tsx
│       ├── Button.tsx
│       └── StatusPill.tsx
```

---

## 20. Frontend State Architecture

- **Server State (TanStack Query):** Active policy sets, version histories, simulation results, audit runs, and regression outcomes.
- **Local UI State (Zustand / React Context):** Active Monaco editor buffer, selected scenario, evidence drawer visibility (`isOpen`, `activeEvidenceId`).
- **URL State:** Synchronized tabs, active project ID, and selected version comparison (`?project=acmepay&vOld=12&vNew=13`).

---

## 21. API Integration Layer

The frontend communicates with backend APIs via typed client SDKs:

```text
[ React UI Components ]
         │
         ▼
[ API Client Wrapper (lib/api.ts) ]
         │
         ▼
[ FastAPI / API Gateway Endpoints ]
```

> **Strict Rule:** The frontend never performs ad-hoc authorization calculations; all decisions and diffs come from backend API responses.

---

## 22. Loading States

- Skeleton loaders for cards and tables during analysis runs.
- Indeterminate cyan progress bars during Strands multi-step audit execution.

---

## 23. Empty States

- Meaningful empty states for workspaces without policies (*"Create your first Cedar Policy Set or load a sample template"*).

---

## 24. Error States

- Inline non-blocking toast notifications for network errors.
- Line-accurate Monaco squiggles for syntax errors.

---

## 25. Responsive Behavior

- Optimized for desktop screens ($1280\text{px}+$ width).
- Collapsible sidebar for compact laptop displays ($1024\text{px}$).

---

## 26. Accessibility

- High contrast text ratios compliant with WCAG AA.
- Keyboard navigation shortcuts (`Cmd/Ctrl + S` to save, `Cmd/Ctrl + Enter` to evaluate).

---

## 27. Frontend Security

- Zero client-side AWS keys.
- Sanitized HTML/Markdown rendering for Bedrock explanations (DOMPurify).

---

## 28. Frontend Testing

- Component unit tests with `vitest` and `@testing-library/react`.
- Snapshot tests for the Hero Blast Radius card.

---

## 29. Demo Mode / Deterministic Fixtures

- Built-in fixture toggle (`useDemoFixtures=true`) ensuring the AcmePay demo functions flawlessly even during network outages.

---

## 30. Implementation Order

1. Setup Design Tokens, Tailwind configuration, and Shell Layout.
2. Integrate Monaco Editor with Cedar syntax highlighter.
3. Build Scenario Simulator and Ad-hoc Evaluation UI.
4. Implement Hero Change Analysis Screen (Blast Radius + Counterexamples).
5. Build Evidence Drawer with Bedrock Explanation container.
6. Build Regression Suite and Deployment Gate components.
