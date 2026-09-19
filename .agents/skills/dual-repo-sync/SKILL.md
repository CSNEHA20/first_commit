---
name: dual-repo-sync
description: Safely synchronize intended code changes across two Git repositories, validate them, commit them, and push them to their configured remotes. Use when the user requests a dual-repository update or push.
---

# Dual Repository Synchronization

## Objective

Synchronize the intended code changes across both configured repositories while
preserving repository-specific instructions, existing work, and Git history.

## Repository configuration

Configure these values before executing the workflow:

* REPO_A: `https://github.com/Vishallakshmikanthan/policylab.git` (Remote: `origin`)
* REPO_B: `https://github.com/CSNEHA20/first_commit.git` (Remote: `first_commit`)
* BRANCH_A: `main`
* BRANCH_B: `main`

Never guess repository paths, remotes, branches, or file mappings.

## Mandatory safety rules

1. Read the root AGENTS.md and any applicable nested AGENTS.md files in both
   repositories before making changes.
2. Inspect `git status`, the current branch, and configured remotes in both
   repositories.
3. Preserve all pre-existing user changes. Never discard, reset, overwrite,
   or stage unrelated modifications.
4. Never assume that the repositories have identical directory structures.
5. Determine which changes belong in each repository. Do not blindly copy the
   entire working tree.
6. Never copy `.git`, credentials, tokens, private keys, environment files,
   build artifacts, dependency caches, or other generated/private data.
7. Do not force-push, rewrite history, or bypass repository protections.
8. If a merge conflict, unexpected branch, unrelated change, or destructive
   operation is encountered, stop and report the issue.
9. Never claim a test or push succeeded without checking its actual result.

## Workflow

### Phase 1: Inspect

* Inspect both repositories and their Git status.
* Confirm their branches and remotes.
* Review recent commits and the differences relevant to the requested work.
* Identify the exact files and changes that need to be synchronized.
* Check for repository-specific contribution and testing instructions.

### Phase 2: Plan

* Prepare a concise change plan for each repository.
* Identify shared changes, repository-specific changes, and files that must
  remain independent.
* Check whether the repositories use different implementations or interfaces.
* Report blockers before proceeding.

### Phase 3: Implement

* Apply only the changes required by the request.
* Preserve each repository's architecture, conventions, and configuration.
* Avoid unrelated refactoring.
* Keep changes minimal and traceable.

### Phase 4: Validate

* Run the relevant tests, lint checks, type checks, and builds available in
  each repository.
* Inspect the final diff in each repository.
* Check for accidental secrets, generated files, and unrelated modifications.
* Report failed or unavailable checks honestly.

### Phase 5: Commit

* Stage only the intended files in each repository.
* Create clear, repository-appropriate commit messages.
* Do not amend or rewrite existing commits unless explicitly requested.

### Phase 6: Push

* Push each repository to its configured remote and intended branch.
* Do not force-push.
* If a push is rejected, inspect the reason and stop rather than overwriting
  remote work.
* Verify the resulting branch and commit state in both repositories.

## Completion report

Report separately for each repository:

* Repository and branch
* Files changed
* Tests and checks performed
* Commit hash
* Push status
* Any remaining issues

Declare the workflow complete only when both repositories have been verified.
If one repository fails, clearly distinguish the successful push from the
failed or incomplete one.
