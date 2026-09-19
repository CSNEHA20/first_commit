# PolicyLab — Technology Stack & Decisions

**Version:** 1.0.0  
**Status:** Approved Architectural Baseline  
**Hackathon:** WeMakeDevs × AWS First Commit 2026  

---

## 1. Technology Philosophy

PolicyLab prioritizes **correctness, determinism, developer ergonomics, and hackathon velocity**. 

Our technology selection principles are:
1. **Zero Fake Infrastructure:** We select AWS services that perform genuine, load-bearing work in the architecture rather than decorating diagrams.
2. **Deterministic Isolation:** The core authorization engine is written in standard Python/Cedar and runs identically locally or in AWS Lambda.
3. **Strict AI Containment:** AI libraries are isolated to explanation and orchestration tasks.
4. **Developer-Grade Aesthetics:** A modern, high-performance web frontend utilizing Monaco Editor and dark-mode design systems.

---

## 2. Frontend

| Layer | Selected Technology | Rationale / Responsibility |
|---|---|---|
| **Core Framework** | **React 18+ / TypeScript** | Industry standard for rich interactive web applications, complete type safety. |
| **Build Tool** | **Vite** | Instant HMR (Hot Module Replacement), fast build times, and seamless modern ESM tooling. |
| **Routing & Querying** | **TanStack Router / Query** | Robust client-side routing, declarative cache management, and server state synchronization. |
| **Styling** | **Tailwind CSS + CSS Variables** | Ergonomic, semantic dark-theme design tokens, ultra-fast UI development. |
| **Component Primitives** | **shadcn/ui / Radix UI** | Accessible, unstyled, composable primitives (Dialogs, Tabs, Tooltips, Drawers). |
| **Code Editor** | **Monaco Editor (`@monaco-editor/react`)** | VS Code's editor engine, custom Cedar syntax tokenizer, line diagnostics, and error squiggles. |
| **Icons** | **Lucide React** | Clean, modern iconography tailored for developer and security tooling. |
| **Animations** | **Framer Motion** | Subdued micro-animations for transitions, evidence drawers, and status changes. |

---

## 3. Backend

| Layer | Selected Technology | Rationale / Responsibility |
|---|---|---|
| **Runtime** | **Python 3.11+** | Native ecosystem for Cedar Python bindings, AWS SDK (`boto3`), Strands SDK, and rapid API prototyping. |
| **API Framework** | **FastAPI** | High-performance asynchronous REST framework, automatic OpenAPI documentation, and Pydantic validation. |
| **Execution Environment** | **AWS Lambda** | Serverless, zero-maintenance compute with instant scale and pay-per-execution economics. |
| **Data Validation** | **Pydantic v2** | Strict schema validation for canonical authorization evidence and API request/response contracts. |

---

## 4. Authorization Ecosystem

| Technology | Responsibility |
|---|---|
| **Cedar Engine (`cedarpolicy`)** | Local and backend policy parsing, AST validation, schema typechecking, and deterministic evaluation. |
| **Amazon Verified Permissions (AVP)** | Managed AWS authorization service; acts as the production policy store and live deployment target. |

---

## 5. Artificial Intelligence

| Technology | Responsibility | Safety Boundary |
|---|---|---|
| **Amazon Bedrock** (Claude 3.5 Sonnet / Claude 3 Haiku) | Ingests structured JSON evidence to generate natural language explanations, risk narratives, and remediation suggestions. | **Zero Authorization Authority:** Never decides whether a request is `ALLOW` or `DENY`. |
| **Strands Agents SDK** | Multi-step agent orchestrating the deterministic tool harness (validation $\to$ diff $\to$ counterexamples $\to$ regression). | **No Autonomous Deployment:** Cannot approve or trigger production deployments without human approval. |

---

## 6. AWS Services Breakdown

Every AWS service included in PolicyLab fulfills a concrete, justified role:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ SERVICE               PURPOSE                         NOT USED FOR             PRIORITY │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Amazon Verified       Production Cedar policy store   Ad-hoc local unit        P0       │
│ Permissions (AVP)     & deployment target             testing sandbox                   │
│                                                                                         │
│ Amazon Bedrock        Evidence explanation &          Computing authorization  P0       │
│ (Claude 3.5)          remediation synthesis           decisions                         │
│                                                                                         │
│ AWS Lambda            Serverless compute for          Long-running batch       P0       │
│                       FastAPI microservices           compilation                       │
│                                                                                         │
│ Amazon DynamoDB       Sub-10ms state store for        Raw large policy         P0       │
│                       versions, scenarios & runs      file contents                     │
│                                                                                         │
│ Amazon S3             Durable storage for `.cedar`    Queryable application    P0       │
│                       files, schemas & audit logs     metadata                          │
│                                                                                         │
│ Amazon API Gateway    HTTP routing, CORS & request    Business logic or        P0       │
│                       rate limiting                   policy evaluation                 │
│                                                                                         │
│ AWS Step Functions    State machine for complex,      Synchronous sub-100ms    P1       │
│                       multi-step audit pipelines      interactive simulations           │
│                                                                                         │
│ AWS Amplify           Hosting and CDN for frontend    Backend compute or       P0       │
│                       React single-page application   database logic                    │
│                                                                                         │
│ Amazon CloudWatch     Centralized structured logging  Primary audit            P0       │
│                       and Lambda telemetry            evidence store                    │
│                                                                                         │
│ Amazon Cognito        User authentication & demo      Authorization logic      Optional │
│                       account management              (handled by Cedar)       / P1     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Storage Strategy

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ AMAZON DYNAMODB (Tables & Keys)                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Table: PolicyLab_Entities                                                               │
│ • PK: PK (e.g., "PROJECT#ps_acmepay")       SK: SK (e.g., "METADATA")                   │
│ • PK: "PROJECT#ps_acmepay"                  SK: "VERSION#v12"                           │
│ • PK: "PROJECT#ps_acmepay"                  SK: "SCENARIO#sc_01"                        │
│ • PK: "PROJECT#ps_acmepay"                  SK: "CONTRACT#contract_03"                  │
│ • PK: "PROJECT#ps_acmepay"                  SK: "AUDIT#audit_991"                       │
│ • PK: "PROJECT#ps_acmepay"                  SK: "DEPLOYMENT#dep_102"                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ AMAZON S3 (Object Storage Layout)                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ s3://policylab-artifacts-{account}-{region}/                                            │
│ ├── projects/                                                                           │
│ │   └── ps_acmepay/                                                                     │
│ │       ├── schema.cedarschema.json                                                     │
│ │       ├── entities.json                                                               │
│ │       └── versions/                                                                   │
│ │           ├── v12/policy.cedar                                                        │
│ │           └── v13/policy.cedar                                                        │
│ └── audits/                                                                             │
│     └── audit_991/                                                                      │
│         ├── raw_evidence.json                                                           │
│         └── audit_report.md                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Testing Stack

- **Unit Testing:** `pytest` for backend domain logic; `vitest` with `@testing-library/react` for frontend components.
- **Cedar Engine Testing:** Direct unit test assertions against standard Cedar test fixtures.
- **Deterministic Mock Adapters:** `MockCedarEngine`, `MockBedrockClient`, `MockAVPAdapter` enabling full offline test suite execution in CI.

---

## 9. Development Tooling

- **Package Managers:** `pnpm` for frontend workspace; `uv` or `pip` with `virtualenv` for Python.
- **Code Quality:** `ruff` and `black` for Python formatting and linting; `eslint` and `prettier` for TypeScript.
- **AWS Local Emulation:** AWS SAM CLI / LocalStack for local Lambda and DynamoDB testing.

---

## 10. Environment Configuration

Standardized `.env` structure across environments:

```bash
# Application Environment
ENVIRONMENT=development # development | staging | production
LOG_LEVEL=INFO

# AWS Infrastructure
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=PolicyLab_Entities
S3_BUCKET_NAME=policylab-artifacts-dev
AVP_POLICY_STORE_ID=ps-demo-store-01

# AI & Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_MAX_TOKENS=2048

# Engine Configuration
CEDAR_ENGINE_MODE=LOCAL # LOCAL | AWS_AVP
```

---

## 11. Security Tooling

- **Least Privilege IAM:** Scoped IAM roles per Lambda function with read-only access to S3 and DynamoDB where possible.
- **CORS Hardening:** Strict origin allowlists on API Gateway.
- **Zero Raw Credentials in UI:** Client application never connects directly to AWS SDK; all access is mediated through authenticated API Gateway endpoints.

---

## 12. Deployment Strategy

- **Infrastructure as Code:** AWS Serverless Application Model (AWS SAM) `template.yaml` for repeatable, automated cloud provisioning.
- **Frontend Hosting:** AWS Amplify / S3 + CloudFront with automated build and deployment hooks.

---

## 13. Local Development Strategy

To allow developers to work offline or without AWS access:
1. Backend runs via `uvicorn main:app --reload` using local file-based or in-memory persistence.
2. The `LocalCedarAdapter` uses native Python Cedar bindings.
3. Bedrock calls fall back to deterministic canned responses when `BEDROCK_MOCK=true`.

---

## 14. Cloud Development Strategy

1. Development branch pushes deploy to a sandbox AWS account via SAM.
2. Integration tests run against live AWS Lambda, DynamoDB, and Amazon Verified Permissions endpoints.

---

## 15. Dependency Principles

- **Minimalist Core:** Avoid heavy enterprise frameworks or unneeded middleware.
- **Pinning:** Explicit version locking for Cedar libraries, AWS SDKs, and frontend packages to prevent build regressions.

---

## 16. Architecture Decision Records (ADR)

### ADR-01: Use Python for Backend Services
- **Status:** APPROVED
- **Context:** Cedar has active Python bindings (`cedarpolicy`), AWS SDK for Python (`boto3`) is battle-tested, and Strands Agents SDK is Python-native.
- **Decision:** Python 3.11+ with FastAPI.

### ADR-02: Local Cedar Evaluation vs. Cloud-Only AVP Evaluation
- **Status:** APPROVED
- **Context:** Running interactive simulations over hundreds of scenarios across network roundtrips to AVP would introduce high latency and API costs.
- **Decision:** Use local Cedar engine bindings for interactive simulation and blast-radius matrix calculation; use Amazon Verified Permissions for final deployment and production verification.

### ADR-03: Bedrock Containment & Prompt Grounding
- **Status:** APPROVED
- **Context:** LLMs must never produce hallucinated security judgments.
- **Decision:** Feed Bedrock only structured JSON evidence containing verified Cedar results; output must separate observed facts from suggested fixes.

### ADR-04: Single DynamoDB Table Design
- **Status:** APPROVED
- **Context:** Simplifies infrastructure provisioning for the hackathon while supporting fast single-item and partition lookups.
- **Decision:** Use a single `PolicyLab_Entities` table with overloaded PK/SK keys.

### ADR-05: Authentication Strategy for Demo
- **Status:** `DECISION REQUIRED` (Recommended: Controlled Demo Session / Simple Token for Day 1-2, optional Cognito integration on Day 3 if time permits).
