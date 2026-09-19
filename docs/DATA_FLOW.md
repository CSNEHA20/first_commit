# PolicyLab — Data Flow & Interaction Models

**Version:** 1.0.0  
**Status:** Approved Specification  
**Hackathon:** WeMakeDevs × AWS First Commit 2026  

---

## 1. System Data Flow

PolicyLab enforces a unidirectional, deterministic data flow:

```mermaid
flowchart TD
    User([User / Operator]) -->|1. Edit / Trigger| UI[React / Monaco Frontend]
    UI -->|2. REST / JSON| APIGW[Amazon API Gateway]
    APIGW -->|3. Invoke| Lambda[FastAPI / AWS Lambda Services]
    
    subgraph Deterministic Core
        Lambda -->|4. Request| Cedar[Cedar Authorization Engine]
        Cedar -->|5. Evaluate| Evidence[Canonical Authorization Evidence]
        Evidence -->|6. Calculate| BlastRadius[Blast Radius & Diff Engine]
        Evidence -->|7. Filter| Counterexamples[Deterministic Counterexamples]
        Evidence -->|8. Test| Regression[Security Contracts & Regression Suite]
    end

    subgraph AI Layer
        Evidence & Counterexamples -->|9. Structured Evidence| Bedrock[Amazon Bedrock / Claude 3.5]
        Bedrock -->|10. Synthesize| Explanations[Grounded Explanations & Remediation]
    end

    subgraph Storage & Target
        Lambda -->|11. Persist State| DDB[(Amazon DynamoDB)]
        Lambda -->|12. Store Artifacts| S3[(Amazon S3)]
        Lambda -->|13. Deploy Verified| AVP[Amazon Verified Permissions]
    end

    Explanations & BlastRadius & Counterexamples -->|14. Return Response| UI
```

---

## 2. User-to-System Flow

1. **User Action:** The user updates a Cedar policy in Monaco Editor or triggers a version comparison.
2. **API Dispatch:** The client issues typed HTTP requests with JWT/API tokens to API Gateway.
3. **Lambda Execution:** Targeted microservices execute deterministic algorithms.
4. **Result Presentation:** Visual updates render in the UI in $<100\text{ms}$ for simulations and $<2\text{s}$ for blast radius diffs.

---

## 3. Policy Creation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React UI
    participant API as Policy Service
    participant S3 as Amazon S3
    participant DDB as Amazon DynamoDB

    User->>UI: Types new Cedar policy / clicks Save
    UI->>API: POST /policies { policySetId, policyText, schema }
    API->>API: Compute SHA-256 Canonical Hash
    API->>S3: PutObject s3://artifacts/projects/{id}/versions/{v}/policy.cedar
    API->>DDB: PutItem (PK: PROJECT#{id}, SK: VERSION#{v}, hash, s3Key)
    API-->>UI: 201 Created { versionId: "v13", hash: "8a3e...91bc" }
```

---

## 4. Policy Validation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Monaco Editor
    participant Engine as Cedar Engine

    User->>UI: Modifies code line
    UI->>Engine: validate_policy(policyText, schemaJson)
    Engine->>Engine: AST Parse & Typecheck
    alt Syntax or Type Error
        Engine-->>UI: ValidationResult { valid: false, errors: [ { line: 4, msg: "Syntax error" } ] }
        UI->>UI: Render Monaco red squiggles
    else Valid Cedar
        Engine-->>UI: ValidationResult { valid: true, diagnostics: [ warnings ] }
        UI->>UI: Clear squiggles, enable Analyze button
    end
```

---

## 5. Simulation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Simulator UI
    participant API as Simulation Lambda
    participant Cedar as Cedar Engine

    User->>UI: Selects Principal, Action, Resource, Context
    UI->>API: POST /simulate { request, policyVersionId }
    API->>Cedar: evaluate(request, policyText, entities)
    Cedar-->>API: CanonicalEvidence (Decision: ALLOW/DENY, Matched Policies)
    API-->>UI: 200 OK (CanonicalEvidence JSON)
    UI->>UI: Display Decision Badge and Matched Policy IDs
```

---

## 6. Versioning Flow

- Every saved modification creates a new immutable version record.
- The parent version ID is permanently linked.
- The canonical SHA-256 hash is computed over normalized policy text to guarantee audit integrity.

---

## 7. Diff Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Changes UI
    participant API as Diff Service
    participant Cedar as Cedar Engine

    User->>UI: Selects v12 (Baseline) vs v13 (Candidate)
    UI->>API: POST /diff { baselineVersion: "v12", candidateVersion: "v13" }
    API->>API: Compute line-by-line textual diff
    API->>API: Extract modified policy AST nodes
    API-->>UI: 200 OK { textDiff, structuralDiff }
    UI->>UI: Render side-by-side Monaco diff
```

---

## 8. Blast Radius Flow

```mermaid
sequenceDiagram
    autonumber
    participant UI as Hero Screen
    participant API as Analysis Lambda
    participant Cedar as Cedar Engine

    UI->>API: POST /analyze { baselineVersion: "v12", candidateVersion: "v13" }
    API->>API: Generate declared scenario universe (P x A x R x C)
    loop For each scenario in universe
        API->>Cedar: Evaluate under v12
        API->>Cedar: Evaluate under v13
    end
    API->>API: Classify transitions (DENY->ALLOW, ALLOW->DENY)
    API->>API: Aggregate affected principals, resources, actions
    API-->>UI: 200 OK { deltaActions: 3, deltaResources: 184, deltaPrincipals: 27, newlyAuthorized: [...] }
    UI->>UI: Render Hero Blast Radius Card with glowing delta badges
```

---

## 9. Counterexample Flow

1. Filter the blast radius results for $\text{DENY} \to \text{ALLOW}$ transitions.
2. Apply the deterministic severity ranking heuristic.
3. Cross-reference against declared Security Contracts.
4. Return top-ranked counterexamples with complete request context.

---

## 10. Security Contract Flow

```mermaid
sequenceDiagram
    autonumber
    actor SecurityEng as Security Engineer
    participant UI as Contracts UI
    participant API as Contract Service
    participant DDB as DynamoDB

    SecurityEng->>UI: Adds Contract ("Contractors cannot delete payroll reports")
    UI->>API: POST /contracts { title, severity: "CRITICAL", scenario: { principal: "contractor", action: "delete", resource: "payroll", expected: "DENY" } }
    API->>DDB: PutItem (PK: PROJECT#{id}, SK: CONTRACT#{cid})
    API-->>UI: 201 Created { contractId: "SC-04" }
```

---

## 11. Regression Flow

```mermaid
sequenceDiagram
    autonumber
    participant UI as Tests UI
    participant API as Regression Lambda
    participant Cedar as Cedar Engine

    UI->>API: POST /regression/run { candidateVersion: "v13" }
    API->>API: Load all active Security Contracts & baseline scenarios
    loop For each scenario
        API->>Cedar: evaluate(scenario, v13_policyText)
        API->>API: Compare actual vs expected decision
    end
    API-->>UI: 200 OK { total: 18, passed: 17, failed: 1, failures: [ { contractId: "SC-04", expected: "DENY", actual: "ALLOW" } ] }
    UI->>UI: Render Regression Suite with 🔴 failure badge on SC-04
```

---

## 12. Bedrock Explanation Flow

```mermaid
sequenceDiagram
    autonumber
    participant UI as Evidence Drawer
    participant API as Explanation Lambda
    participant Bedrock as Amazon Bedrock (Claude 3.5)

    UI->>API: POST /explain { findingId, canonicalEvidence, contractDetails }
    API->>API: Construct structured grounding prompt (Strict facts only)
    API->>Bedrock: InvokeModel(prompt, max_tokens: 1024)
    Bedrock-->>API: Response JSON { summary, rootCause, securityRisk, remediationCedar }
    API-->>UI: 200 OK { explanation }
    UI->>UI: Render Bedrock AI Explanation card below deterministic evidence
```

---

## 13. Strands Agent Flow

```mermaid
flowchart TD
    Start([Trigger Audit]) --> Agent[Strands PolicyAuditAgent]
    Agent --> Tool1[Tool: validate_policy]
    Tool1 --> Tool2[Tool: calculate_semantic_diff]
    Tool2 --> Tool3[Tool: find_counterexamples]
    Tool3 --> Tool4[Tool: run_regression_suite]
    Tool4 --> Tool5[Tool: summarize_with_bedrock]
    Tool5 --> Finish([Consolidated Audit Report])
```

---

## 14. Audit Flow

1. End-to-end execution of validation, diffing, counterexample generation, regression tests, and Bedrock synthesis.
2. Generates an immutable `AuditRun` record stored in DynamoDB and S3.
3. Sets overall gate status: `VERIFIED` or `BLOCKED`.

---

## 15. Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Release Operator
    participant UI as Deploy UI
    participant API as Deployment Lambda
    participant AVP as Amazon Verified Permissions
    participant DDB as DynamoDB

    Operator->>UI: Clicks "Deploy to Verified Permissions"
    UI->>API: POST /deploy { policyVersionId: "v13", targetStoreId: "ps-acmepay-prod" }
    API->>API: Pre-Deployment Gate Check (Verify 0 critical findings & 100% regression pass)
    alt Gate Failed
        API-->>UI: 403 Forbidden { code: "DEPLOYMENT_GATE_BLOCKED", reason: "Failing contracts" }
        UI->>UI: Show red blocking banner
    else Gate Passed
        API->>AVP: PutPolicy / UpdatePolicy(targetStoreId, policyText)
        API->>DDB: PutItem (PK: PROJECT#{id}, SK: DEPLOYMENT#{did}, status: "SUCCESS")
        API-->>UI: 200 OK { status: "DEPLOYED", deployedAt: timestamp }
        UI->>UI: Display green verified deployment confirmation
    end
```

---

## 16. Failure Flows

- **Cedar Syntax Failure:** Block compilation immediately; display line squiggles.
- **Contract Regression:** Hard-block deployment gate; mark audit run as `BLOCKED`.
- **Bedrock API Timeout:** Return deterministic Cedar evidence with a fallback note (*"AI explanation temporarily unavailable; deterministic evidence intact"*).

---

## 17. Data Ownership

- **User / Organization:** Owns all policy files, schemas, scenario fixtures, and contract definitions.
- **PolicyLab System:** Manages computed hashes, diff matrices, and audit execution metadata.

---

## 18. Data Persistence

### Amazon DynamoDB Schema

```text
Table: PolicyLab_Entities
PK                      | SK                     | Attributes
------------------------------------------------------------------------------------------------------------------------
PROJECT#ps_acmepay      | METADATA               | { name: "AcmePay Core", activeVersion: "v12", owner: "Vishal" }
PROJECT#ps_acmepay      | VERSION#v12            | { version: 12, hash: "4f1a...89a1", s3Key: "...", status: "DEPLOYED" }
PROJECT#ps_acmepay      | VERSION#v13            | { version: 13, hash: "8a3e...91bc", s3Key: "...", status: "BLOCKED" }
PROJECT#ps_acmepay      | CONTRACT#sc_04         | { title: "Contractors cannot delete payroll", severity: "CRITICAL" }
PROJECT#ps_acmepay      | AUDIT#audit_991        | { baseline: "v12", candidate: "v13", regressions: 1, status: "BLOCKED" }
PROJECT#ps_acmepay      | DEPLOYMENT#dep_01      | { version: "v12", storeId: "ps-acmepay-prod", deployedAt: "..." }
```

### Amazon S3 Object Hierarchy

```text
s3://policylab-artifacts-prod/
├── projects/
│   └── ps_acmepay/
│       ├── schema.json
│       ├── entities.json
│       └── versions/
│           ├── v12/policy.cedar
│           └── v13/policy.cedar
└── audits/
    └── audit_991/
        ├── evidence.json
        └── report.md
```

---

## 19. Sensitive Data Boundaries

- PolicyLab evaluates authorization using tokenized principal and resource identifiers (e.g., `User::"alice"`), never requiring real PII or live database credentials.

---

## 20. AI Data Boundary

- Amazon Bedrock is sent **only** structured JSON facts.
- Prompts explicitly forbid the model from making authorization decisions or evaluating access rules.

---

## 21. Deterministic Evidence Boundary

- Every piece of data surfaced to the UI originates from Cedar execution logs and mathematical set operations before reaching the user or Bedrock.

---

## 22. End-to-End Data Flow

From policy edit in Monaco to verified production sync in Amazon Verified Permissions, all state transitions are immutable, cryptographically verifiable, and strictly gated by deterministic evidence.

---

## 23. Enforced 9-Stage Evaluation Pipeline Data Flow (Stage D)

PolicyLab enforces a strict sequential pipeline before Cedar evaluation:

```mermaid
flowchart TD
    Step1[1. Load Policy Version] --> Step2[2. Resolve Cedar Schema]
    Step2 --> Step3[3. Validate Policy Syntax & Types]
    Step3 -->|Valid| Step4[4. Load / Resolve Entity Snapshot]
    Step3 -->|Syntax Error| Fail[Return INVALID_INPUT with DENY]
    Step4 --> Step5[5. Validate Entity Graph Structure & Parents]
    Step5 -->|Valid| Step6[6. Validate Request & Context Identifiers]
    Step5 -->|Malformed Entities| Fail
    Step6 -->|Valid| Step7[7. Deterministic Cedar Evaluation]
    Step6 -->|Invalid Types / Missing Fields| Fail
    Step7 --> Step8[8. Normalize Result into Canonical Form]
    Step8 --> Step9[9. Record Canonical Evidence with SHA-256 Provenance]
```

---

## 24. Enterprise Database Adapter Extension Architecture (Stage B)

PolicyLab decouples authorization evaluation from concrete database engines via the `IEntityProvider` contract. Additional enterprise adapters can be plugged in without modifying the Cedar engine or diff pipeline:

```text
┌────────────────────────────────────────────────────────┐
│               PolicyLab Cedar Engine                   │
└───────────────────────────┬────────────────────────────┘
                            │ Consumes Cedar JSON Entities
┌───────────────────────────▼────────────────────────────┐
│                    IEntityProvider                     │
│  (get_entity, load_entities, load_snapshot, etc.)      │
└───────┬─────────────┬─────────────┬─────────────┬──────┘
        │             │             │             │
┌───────▼──────┐┌─────▼──────┐┌─────▼──────┐┌─────▼──────┐
│  Fixture     ││ DynamoDB   ││ PostgreSQL ││  LDAP / AD │
│  Provider    ││ Provider   ││ Provider   ││  Provider  │
└──────────────┘└────────────┘└────────────┘└────────────┘
```

### Implementing Future Enterprise Adapters:

1. **PostgreSQL Adapter (`PostgreSQLEntityProvider`):**
   - Query: `SELECT entity_type, entity_id, attributes, parent_uids FROM authorization_entities WHERE entity_uid = ANY(%s);`
   - Mapping: Converts relational columns into Cedar JSON (`{"uid": {"type": row.entity_type, "id": row.entity_id}, "attrs": row.attributes, "parents": row.parent_uids}`).
   - Connection pooling via `asyncpg` or SQLAlchemy.

2. **Redis Adapter (`RedisEntityProvider`):**
   - Query: `MGET entity:User:alice entity:Role:admin`
   - Mapping: Parses cached JSON string records into Cedar entity objects.
   - Ideal for ultra-low latency request-scoped entity lookups ($<2\text{ms}$).

3. **LDAP / Active Directory Adapter (`LDAPEntityProvider`):**
   - Query: LDAP search filter `(&(objectClass=user)(sAMAccountName=alice))` with memberOf attribute mapping.
   - Mapping: Maps user CN and group memberships into `Role` and `Group` parent entities.

---

## 25. AWS Step Functions Asynchronous Audit Orchestration (Stage I2)

For multi-stage verification workflows on larger scenario suites, PolicyLab orchestrates through an asynchronous Step Functions state machine (`infrastructure/statemachines/audit_workflow.asl.json`):

```text
ValidateCandidatePolicy
  │
  ├── [Syntax Error] ──► AuditHaltedSyntaxError (Fail)
  │
  └── [Valid]
        │
        ▼
ExecuteSemanticDiffAndRegression
        │
        ├── [PASS] ──► GenerateGroundedExplanation ──► StoreAuditReport ──► Complete
        │
        └── [BLOCKED] ─► GenerateViolationExplanation ─► StoreAuditReport ─► Complete
```

---

## 26. Phase 8 Verified Deployment & Observability Data Flow

```text
Operator / UI                PolicyLab Backend               Verified Permissions           CloudWatch Logs
     │                               │                                 │                            │
     │── 1. Prepare Deployment ─────►│                                 │                            │
     │   (candidateText, targetEnv)  │── Compute Candidate SHA-256     │                            │
     │                               │── Check Gate == PASS?           │                            │
     │                               │── (If BLOCKED: Blocked, Stop)   │                            │
     │                               │                                 │── Log Metric ─────────────►│
     │◄── Return Prepared Record ────│                                 │   DeploymentPrepared /     │
     │    (prepId, policyHash, OK)   │                                 │   DeploymentBlocked (EMF)  │
     │                               │                                 │                            │
     │── 2. Register Human Sign-Off ─►                                 │                            │
     │   (prepId, policyHash, approv)│── Verify Policy Hash Match      │                            │
     │                               │── Verify Gate is PASS           │                            │
     │                               │── Store Approval Token          │── Log Metric ─────────────►│
     │◄── Return Approval Token ─────│                                 │   HumanApprovalGranted     │
     │                               │                                 │                            │
     │── 3. Submit Deployment ──────►│                                 │                            │
     │   (token, candidateText)      │── Verify Token Exists           │                            │
     │                               │── Verify Policy Hash Matches    │                            │
     │                               │   Token Digest (Anti-Tamper)    │                            │
     │                               │── Invoke create_policy() ──────►│                            │
     │                               │◄── Return policyId / proof ─────│                            │
     │                               │── Record in Audit Ledger        │── Log Metric ─────────────►│
     │◄── Return Synchronized ───────│                                 │   DeploymentSubmitted (EMF)│
```


