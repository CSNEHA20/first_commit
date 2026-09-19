# PolicyLab

> **Prove your authorization changes before they reach production.**

[![Hackathon](https://img.shields.io/badge/AWS-First%20Commit%202026-orange)](https://wemakedevs.org)
[![Team](https://img.shields.io/badge/Team-VibeSync-blue)](https://github.com/Vishallakshmikanthan)
[![Cedar](https://img.shields.io/badge/Authz-Cedar%20Policy-green)](https://www.cedarpolicy.com)
[![Status](https://img.shields.io/badge/Status-Documentation%20Foundation%20Complete-brightgreen)]()

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
3. **Verified Deployment Gate:** A hard pre-deployment verification gate that synchronizes approved, green policies with **Amazon Verified Permissions**.

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
               │        (Local / Native Engine)          │
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
- **Backend:** Python 3.11+, FastAPI, AWS Lambda, Pydantic v2.
- **Authorization:** Cedar (`cedarpolicy`), Amazon Verified Permissions (AVP).
- **AI & Orchestration:** Amazon Bedrock (Anthropic Claude 3.5 Sonnet), Strands Agents SDK.
- **Persistence & Cloud:** Amazon DynamoDB, Amazon S3, AWS API Gateway, AWS Amplify, Amazon CloudWatch.
- **Infrastructure:** AWS Serverless Application Model (AWS SAM).

---

## Repository Structure

```text
policylab/
│
├── frontend/             # React/TypeScript single-page application (To be implemented)
├── backend/              # Python/FastAPI microservices & Cedar domain engine (To be implemented)
├── infrastructure/       # AWS SAM template.yaml & parameter configurations (To be implemented)
├── fixtures/             # AcmePay demo policies (v12, v13), entities, and scenarios (To be implemented)
├── tests/                # Unit, integration, and AI grounding test suites (To be implemented)
├── docs/                 # Authoritative Engineering Documentation Foundation
│   ├── PRD.md
│   ├── SPEC.md
│   ├── TECH_STACK.md
│   ├── FRONTEND_IMPLEMENTATION.md
│   ├── DATA_FLOW.md
│   └── ARCHITECTURE.md
│
└── README.md
```

---

## Documentation Links

Complete engineering specifications are available in the [`docs/`](./docs) directory:

- [**PRD (Product Requirements Document)**](./docs/PRD.md) — Product vision, personas, user stories, AcmePay canonical demo story, and hero features.
- [**Technical Specification**](./docs/SPEC.md) — Canonical evidence model, scenario formats, semantic diffing algorithms, and API contracts.
- [**Technology Stack & ADRs**](./docs/TECH_STACK.md) — Detailed technology choices, AWS service responsibilities, and architectural decision records.
- [**Frontend Implementation Guide**](./docs/FRONTEND_IMPLEMENTATION.md) — Dark-mode design system, screen wireframes, Monaco integration, and evidence drawer UX.
- [**Data Flow Specification**](./docs/DATA_FLOW.md) — Sequence diagrams, data ownership, failure handling, and DynamoDB/S3 persistence layouts.
- [**System Architecture**](./docs/ARCHITECTURE.md) — High-level architecture, trust boundaries, adapter patterns, and four-day build roadmap.

---

## Current Implementation Status

| Milestone | Status | Description |
|---|---|---|
| **Phase 0: Documentation Foundation** | **COMPLETE** | Comprehensive PRD, Technical Spec, Architecture, Data Flow, Tech Stack, and Frontend blueprints finalized. |
| **Phase 1: Cedar Engine & Simulation** | *Pending* | Core Cedar parser, scenario evaluation, and local adapter implementation. |
| **Phase 2: Semantic Diff & Blast Radius** | *Pending* | Matrix evaluation, population deltas, and counterexample generation. |
| **Phase 3: Security Contracts & AI** | *Pending* | Regression harness, Amazon Bedrock explanation, and Strands audit agent. |
| **Phase 4: AWS Persistence & AVP** | *Pending* | DynamoDB/S3 integration and Verified Permissions deployment gate. |
| **Phase 5: Frontend & Demo Video** | *Pending* | Monaco UI, Evidence Drawers, and 3-minute AcmePay demo recording. |

---

## Hackathon Context

- **Event:** WeMakeDevs × AWS First Commit 2026
- **Team:** VibeSync — Vishal & Sneha
- **Timeline:** 4-day sprint
