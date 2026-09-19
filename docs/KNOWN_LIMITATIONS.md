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
