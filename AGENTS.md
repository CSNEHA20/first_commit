# PolicyLab — Agent Guidelines & Repository Context

## Project Overview
- **Project:** PolicyLab
- **Tagline:** *Prove your authorization changes before they reach production.*
- **Hackathon:** WeMakeDevs × AWS First Commit 2026
- **Team:** VibeSync (Vishal & Sneha)

## Core Architectural Rules
1. **AI DOES NOT DECIDE AUTHORIZATION:** Cedar and deterministic logic are the sole arbiters of authorization truth. AI only explains structured evidence.
2. **Canonical Evidence Model:** All higher-level components consume the standardized JSON authorization evidence payload.
3. **Dual Repository Synchronization:** Code changes are synchronized across both configured remotes:
   - `origin` -> `https://github.com/Vishallakshmikanthan/policylab.git`
   - `first_commit` -> `https://github.com/CSNEHA20/first_commit.git`
4. **Local Testability:** All domain logic and Cedar evaluation must remain testable locally via adapter interfaces (`LocalCedarAdapter`).
5. **Deterministic Deployment Gates:** Deployment to Amazon Verified Permissions is blocked if security contract regression tests fail.

## Workspace Layout
- `frontend/` — React 18+, TypeScript, Vite, Tailwind CSS, shadcn/ui, Monaco Editor.
- `backend/` — Python 3.11+, FastAPI, Cedar domain engine, AWS Lambda handlers (To be implemented).
- `infrastructure/` — AWS SAM templates (To be implemented).
- `fixtures/` — AcmePay demo fixtures (v12, v13, scenarios) (To be implemented).
- `docs/` — Authoritative engineering documentation foundation.
- `.agents/skills/dual-repo-sync/` — Skill for dual-repository synchronization.
