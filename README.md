# PolicyLab

> **Prove your authorization changes before they reach production.**

[![Hackathon](https://img.shields.io/badge/AWS-First%20Commit%202026-orange)](https://wemakedevs.org)
[![Team](https://img.shields.io/badge/Team-VibeSync-blue)](https://github.com/Vishallakshmikanthan)
[![Cedar](https://img.shields.io/badge/Authz-Cedar%20Policy%20v4.13-green)](https://www.cedarpolicy.com)
[![Tests](https://img.shields.io/badge/Tests-120%20Passed%20%7C%200%20Failed-brightgreen)]()
[![Status](https://img.shields.io/badge/Status-Submission%20Ready%20(Phase%209)-brightgreen)]()

PolicyLab is an authorization change-verification and policy-engineering platform built around Cedar and the AWS authorization ecosystem. It transforms authorization policy updates into measurable, traceable, testable, explainable, and reviewable workflows before changes reach production.

---

## The Problem

Modern cloud applications separate authentication from fine-grained authorization. While syntax linters ensure that Cedar policies compile, they cannot predict the **behavioral security impact** of a policy edit.

A single-line change (e.g., modifying an action clause or relaxing a resource condition) can silently expand permissions across dozens of roles and hundreds of sensitive resources. Text diffs show what syntax changed, but fail to answer the critical question:
> **"What changed in the authorization behavior of my system?"**

---

## The Solution

PolicyLab makes authorization changes observable, testable, and explainable before deployment:

1. **Deterministic Security Layer:** Evaluates Cedar policies, computes bounded authorization blast radii, extracts concrete counterexamples, and executes security contract regression suites.
2. **AI Reasoning & Explanation Layer (Amazon Bedrock & Strands):** Ingests structured deterministic evidence to explain why changes occurred and suggest precise policy fixes. **AI never decides authorization.**
3. **Verified Deployment Gate:** A hard pre-deployment verification gate requiring explicit human sign-off bound to the candidate policy's SHA-256 hash before synchronizing green policies with **Amazon Verified Permissions**.

---

## Core Workflow

```text
WRITE ──► VALIDATE ──► SIMULATE ──► DIFF ──► ANALYZE ──► COUNTEREXAMPLES ──► EXPLAIN ──► REGRESSION TESTS ──► VERIFY ──► DEPLOY
```

---

## Architecture Overview

```text
                                 POLICYLAB
                                     │
                                     ▼
                              React Frontend
                        (Tailwind + Monaco Editor)
                                     │
                                     ▼
                                API Gateway
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
          Policy Service       Simulation           Analysis
             Lambda              Lambda               Lambda
                │                    │                    │
                │                    ▼                    │
                │              Cedar Engine               │
                │        (Cedar WASM Runtime)            │
                │                    │                    │
                └────────────────────┬────────────────────┘
                                     ▼
                             Analysis Pipeline
                                │          │
                                ▼          ▼
                          Cedar/Domain   Strands Agent
                                │          │
                                └────┬─────┘
                                     ▼
                              Amazon Bedrock
                           (Claude 3.5 Sonnet)
                                     │
                                     ▼
                              Audit Evidence
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
          Amazon DynamoDB        Amazon S3         Amazon Verified
          (State & Keys)      (Cedar Artifacts)      Permissions
```

---

## Technology Stack

- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide React.
- **Backend:** Python 3.11+, FastAPI, AWS Lambda (Mangum ASGI), Pydantic v2.
- **Authorization:** Cedar (`@cedar-policy/cedar-wasm`), Amazon Verified Permissions (AVP).
- **AI & Orchestration:** Amazon Bedrock (Anthropic Claude 3.5 Sonnet), Strands Agents SDK.
- **Persistence & Cloud:** Amazon DynamoDB, Amazon S3, AWS API Gateway, AWS Step Functions, Amazon CloudWatch.
- **Infrastructure as Code:** AWS Serverless Application Model (AWS SAM).

---

## Dual-Execution Mode

PolicyLab supports two execution modes:

- **Local / Offline Mode (`dev`):** Zero cloud cost ($0.00 spent). Executes 100% of Cedar evaluation, behavioral diffing, counterexample generation, security contracts, and deployment gating via deterministic in-memory adapters and local fixture snapshots.
- **Live AWS Mode (`prod` / `strict`):** Boto3 SDK clients connect to Amazon Verified Permissions, Amazon Bedrock (Claude 3.5 Sonnet), DynamoDB single-table, and S3 artifact buckets when AWS credentials and configuration flags are provided. In strict mode, missing credentials fail closed immediately.

---

## Repository Structure

```text
policylab/
├── frontend/             # React 18+ / TypeScript / Vite / Tailwind / Monaco Editor
├── backend/              # Python 3.11+ / FastAPI / Cedar Engine / AWS Adapters / Lambda Handler
│   ├── core/             # AWS Config, CloudWatch EMF Logging, Security Payload Bounds
│   ├── domain/           # Cedar Engine, Diff, Counterexamples, Contracts, Regression
│   │   ├── ai/           # Bedrock Explanations, Generator, Strands Agent, Report Export
│   │   ├── avp/          # Amazon Verified Permissions Adapter & Human Approval Service
│   │   ├── cedar/        # Cedar WASM Bridge, Scenario Runner, Matrix, What-If
│   │   ├── models/       # Pydantic Domain Models (Authz, Diff, Evidence, Deployment)
│   │   └── persistence/  # DynamoDB Single-Table, S3 Storage, Timeline, Stored Provider
│   └── lambda_handler.py # Dual-mode dispatcher (Mangum HTTP + Step Functions direct tasks)
├── infrastructure/       # AWS SAM template.yaml & Step Functions ASL state machine
├── fixtures/             # AcmePay demo policies (v12, v13, v13_fixed), entities, and scenarios
├── tests/                # 120 automated unit, integration, failure-injection, and E2E tests
│   ├── unit/             # 16 unit test modules (Cedar, Diff, Contracts, Gate, AWS, Security)
│   └── integration/      # 9 integration test modules (AcmePay E2E, APIs, AWS Status)
└── docs/                 # Authoritative Engineering Documentation & Deliverables
```

---

## Authoritative Documentation

| Document | Purpose |
| :--- | :--- |
| [**PHASE 9 GAP AUDIT**](./docs/PHASE9_GAP_AUDIT.md) | Requirement-by-requirement audit covering all capabilities, evidence, gaps, and priorities. |
| [**IMPLEMENTATION TRACEABILITY**](./docs/IMPLEMENTATION_TRACEABILITY.md) | Full traceability matrix mapping all blueprint and addendum requirements to source and tests. |
| [**TESTING & VERIFICATION REPORT**](./docs/TESTING_AND_VERIFICATION.md) | Official test execution summary (120/120 passing), coverage breakdown, and failure cases. |
| [**AWS DEPLOYMENT & CLEANUP GUIDE**](./docs/AWS_DEPLOYMENT_AND_CLEANUP.md) | SAM deployment runbook, environment variables, live verification commands, and teardown. |
| [**KNOWN LIMITATIONS & DISCLOSURES**](./docs/KNOWN_LIMITATIONS.md) | Truthful disclosures: bounded universe analysis, local vs. cloud execution, AI non-authority. |
| [**PRODUCT REQUIREMENTS DOCUMENT (PRD)**](./docs/PRD.md) | Product vision, personas, user stories, AcmePay canonical demo story, and hero features. |
| [**TECHNICAL SPECIFICATION**](./docs/SPEC.md) | Canonical evidence model, scenario formats, semantic diffing algorithms, and API contracts. |
| [**SYSTEM ARCHITECTURE**](./docs/ARCHITECTURE.md) | High-level architecture, trust boundaries, adapter patterns, and build roadmap. |
| [**DATA FLOW SPECIFICATION**](./docs/DATA_FLOW.md) | Sequence diagrams, data ownership, failure handling, and DynamoDB/S3 persistence layouts. |

---

## Getting Started: Local Development & Testing

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm

### 2. Backend Setup
```bash
# Navigate to backend and create virtual environment
cd backend
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
cd ..
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Run the Full Automated Test Suite (120 Tests)
```bash
backend\.venv\Scripts\python.exe -m pytest -v
```

### 5. Run the Canonical AcmePay 18-Step Full Lifecycle Test
```bash
backend\.venv\Scripts\python.exe -m pytest tests/integration/test_acmepay_e2e_full_lifecycle.py -v
```

### 6. Start Local Development Servers
```bash
# Terminal 1: Backend API (FastAPI)
backend\.venv\Scripts\uvicorn.exe backend.main:app --reload --port 8000

# Terminal 2: Frontend Web Client (Vite)
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser to explore the PolicyLab workbench.

---

## Live AWS Deployment (AWS SAM)

When ready to deploy into an AWS account with active credentials:

```bash
# 1. Validate SAM template
sam validate -t infrastructure/template.yaml

# 2. Build serverless bundle
sam build -t infrastructure/template.yaml

# 3. Deploy guided stack
sam deploy --guided --stack-name policylab-prod --region us-east-1 --capabilities CAPABILITY_IAM
```

See [**AWS Deployment & Cleanup Guide**](./docs/AWS_DEPLOYMENT_AND_CLEANUP.md) for full instructions and teardown commands.

---

## Canonical AcmePay Demo Story

1. **Baseline Policy (`v12`):** Least-privilege permissions where editors can view and edit department invoices, but cannot delete invoices or access payroll data.
2. **Accidental Expansion (`v13`):** Developer broadens action clause to allow `action` (all actions) on `Invoice` for `Role::"editor"`.
3. **Behavioral Diff & Blast Radius:** Detects **+2 newly authorized actions** (`delete`, `export`) across all 184 invoice instances.
4. **Concrete Counterexample:** `User::"editor_bob"` executing `Action::"delete"` on `Invoice::"inv-9082"` flips from `DENY` to `ALLOW`.
5. **Replay Verification:** `/counterexamples/replay` deterministically reproduces the exact decision flip.
6. **Security Contract Invariant:** Security Contract `SC-03` (*"Editor Invoice Deletion Prohibited"*) fails.
7. **Regression Gate:** Pre-deployment gate evaluates to **`status: BLOCKED`**.
8. **Grounded AI Explanation:** Bedrock / deterministic fallback explains the root cause with direct evidence citations.
9. **Policy Fix (`v13_fixed`):** Replaces broad action with explicit equality; regression rerun evaluates to **`status: PASS`**.
10. **Verified Deployment:** Human operator registers approval tied to policy hash; policy is synchronized to Amazon Verified Permissions.

---

## Hackathon Submission Summary

- **Hackathon:** WeMakeDevs × AWS First Commit 2026
- **Team:** VibeSync (Vishal Lakshmikanthan & Sneha C.)
- **Category:** Authorization Engineering / Security Developer Tooling
- **Git Remotes:**
  - `origin`: `https://github.com/Vishallakshmikanthan/policylab.git`
  - `first_commit`: `https://github.com/CSNEHA20/first_commit.git`
- **Cost Discipline:** Built to operate within ~$100 promotional credits; $0.00 spent during local verification.
