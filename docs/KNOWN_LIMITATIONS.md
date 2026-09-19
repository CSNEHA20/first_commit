# PolicyLab — Known Limitations & Architectural Disclosures
## Phase 9 Final Deliverable | WeMakeDevs × AWS First Commit 2026

**Product:** PolicyLab — Authorization Verification & Policy Engineering Platform  
**Team:** VibeSync (Vishal Lakshmikanthan & Sneha C.)  
**Document Version:** 1.0.0  
**Date:** 2026-09-19  

---

## 1. Philosophical & Engineering Honesty

In accordance with Phase 9 Non-Negotiable Rule 0 (*"Distinguish clearly between implemented and locally tested, mocked only, and live verified"*), this document transparently sets out the operational boundaries, known limitations, and deliberate design tradeoffs of PolicyLab.

---

## 2. Core Limitations & Boundary Disclosures

### 1. Bounded Universe Analysis (No False Claims of Universal Equivalence)
- **Design:** PolicyLab evaluates authorization policies across a **declared, bounded scenario universe and entity snapshot**.
- **Limitation:** PolicyLab does **not** perform infinite mathematical symbolic execution or SMT-solver theorem proving over arbitrary unbounded state spaces.
- **Truthful Claim:** When a policy diff reports "+2 newly authorized actions" or "0 blocking violations", that claim is strictly true **with respect to the evaluated scenario suite and entity graph**. Unspecified edge cases outside the declared scenario suite are neither checked nor claimed to be verified.

### 2. Dual-Execution Mode (Local Simulation vs. Live AWS)
- **Local Dev / Offline Mode:** Uses deterministic in-memory repositories (`InMemoryPolicyLabRepository`), local artifact caches, and simulated AVP adapters (`DeterministicFakeAVPAdapter`).
- **Live AWS Mode:** Boto3 SDK clients for Amazon Verified Permissions, Amazon Bedrock, DynamoDB, S3, and Step Functions activate only when valid AWS credentials and configuration flags are provided.
- **Limitation in Current Test Environment:** In the checked-out test environment, `boto3.Session().get_credentials()` is `None`. Live cloud operations are `MOCKED_ONLY` or `CONFIGURED_NOT_VERIFIED`. No AWS costs have been incurred ($0.00 spent to date).

### 3. AI Non-Authority Invariant
- **Rule:** **AI DOES NOT DECIDE AUTHORIZATION.**
- **Implementation:** Amazon Bedrock (Claude 3.5 Sonnet) and Strands Agents generate natural-language explanations, risk summaries, and proposed Cedar remediations.
- **Limitation:** Bedrock output is strictly advisory. The boolean authorization decision (`ALLOW` / `DENY`), the regression gate decision (`PASS` / `BLOCKED`), and the deployment gate are computed deterministically by the Cedar engine.
- **Draft Status:** Any candidate policy generated via natural-language prompting is explicitly tagged as `UNTRUSTED DRAFT - REQUIRES DETERMINISTIC VALIDATION`.

### 4. Cedar WASM Subprocess Bridge
- **Implementation:** The backend bridges to `@cedar-policy/cedar-wasm` via a Node.js subprocess (`cedar_bridge.js`).
- **Limitation:** Node.js 18+ is required on the host system to run the WASM bridge. Subprocess invocations incur a ~25–40ms startup latency for ad-hoc evaluations (which is cached and optimized in batch simulation runs).
- **Future Work:** Compiling Cedar directly to a native Python C-extension / Rust pyo3 binding for sub-5ms in-process execution.

### 5. Single-Table Optimistic Concurrency
- **Implementation:** DynamoDB persistence enforces conditional writes (`attribute_not_exists(PK)`).
- **Limitation:** Concurrent writes to the exact same policy version partition will fail with a `PolicyVersionConflictError`. The client must refetch the latest version and retry.

### 6. Security Payload Limits
To defend against denial-of-service, memory exhaustion, and regex injection, PolicyLab enforces strict upper bounds:
- **Maximum Policy Size:** 64 KB (requests exceeding 65,536 bytes return HTTP 413).
- **Maximum Scenario Count:** 500 scenarios per suite.
- **Maximum Entity Count:** 5,000 entities per graph.
- **Request Timeout:** 30 seconds for batch simulation.

### 7. Entity Graph Normalization
- **Implementation:** Custom entity providers normalize backend records to Cedar entity shapes (`id`, `typeName`, `attributes`, `parents`).
- **Limitation:** Non-standard entity graphs with circular parent hierarchies or malformed UIDs fail closed with a `ValidationError` rather than guessing or defaulting to root.

### 8. Production API Authentication & Cognito Identity Provider Integration
- **Implementation:** `infrastructure/template.yaml` declares a dedicated, self-contained Amazon Cognito User Pool (`PolicyLabUserPool`) and SPA User Pool Client (`PolicyLabUserPoolClient`). The HTTP API Gateway v2 enforces edge JWT authentication (`CognitoJwtAuthorizer`) as the default authorizer across all business and deployment endpoints.
- **Fail-Closed Runtime:** The FastAPI backend security module (`backend/core/auth.py`) extracts edge-verified claims (`requestContext.authorizer.jwt.claims`) or validates incoming bearer tokens, strictly enforcing HTTP 401 Unauthorized for missing, malformed, or expired credentials when `ENVIRONMENT=prod` or `AUTH_STRICT=true`.
- **Role-Based Access Control (RBAC):** Sensitive endpoints enforce platform roles (`approver` or `admin` for `/deployment/approve`; `deployer` or `admin` for `/deployment/submit`), returning HTTP 403 Forbidden for unauthorized identities.
- **Local Development Continuity:** Local development (`ENVIRONMENT=dev`, `AUTH_ALLOW_LOCAL_DEV=true`) provides an offline fallback session with seamless in-browser role emulation (`UserSessionBadge`), permitting full end-to-end testing without external network dependencies.
- **Live User Signup Status:** While the SAM infrastructure template and backend/frontend logic are 100% verified locally, live Amazon Cognito user registration will be executed upon initial stack deployment.

### 9. Lambda Packaging & Cross-Platform Native Dependencies
- **Packaging Structure:** `infrastructure/template.yaml` specifies `CodeUri: ../backend` and uses SAM's native `ParentPackageMode: explicit` (`ParentPackages: backend`). This guarantees that `backend/requirements.txt` is resolved by `pip` while preserving the `backend.lambda_handler.handler` package structure and excluding `frontend/node_modules/`.
- **Runtime Compatibility:** Python dependencies with native C/Rust extensions (such as `pydantic-core`) must match AWS Lambda's Linux x86_64 environment. SAM CLI's `DependencyBuilder` retrieves `manylinux_2_17_x86_64` wheels for the target Python 3.11 runtime.
