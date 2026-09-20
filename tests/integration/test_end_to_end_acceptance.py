"""
PolicyLab Comprehensive End-to-End Acceptance Test Suite (Stages A through L)
WeMakeDevs × AWS First Commit 2026 | Team VibeSync

Exercises the entire PolicyLab verification, governance, and deployment pipeline:
Stage A: Application Health & Cedar WASM Connectivity
Stage B: Cognito Authentication & Fail-Closed JWT Enforcement
Stage C: Platform Role-Based Access Control (RBAC: viewer, engineer, approver, deployer, admin)
Stage D: Cedar Policy AST Validation & Schema-Aware Typechecking
Stage E: Behavioral Diff, Blast Radius & Counterexample Replay Reproduction
Stage F: Security Contract Invariants & Automated Pre-Deployment Regression Gate
Stage G: Strands PolicyAuditAgent Orchestration & Audit Retrieval
Stage H: Structured Audit Report Export (Markdown & JSON)
Stage I: Cryptographically Bound Human Approval & Post-Approval Tampering Invalidation
Stage J: Amazon Verified Permissions Deployment Submission & Remote Verification Proof
Stage K: Persistence Integrity (Conditional Writes & S3 SHA-256 Verification)
Stage L: Step Functions Asynchronous Execution & Fail-Closed Status Handling
"""

import hashlib
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.auth import create_token_for_testing
from backend.domain.models.deployment import DeploymentStatus
from backend.domain.models.regression import DeploymentGateStatus

client = TestClient(app)
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


@pytest.fixture(scope="module")
def baseline_v12():
    return (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def candidate_v13():
    return (FIXTURES_DIR / "candidate_policy_v13.cedar").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def candidate_v13_fixed():
    return (FIXTURES_DIR / "candidate_policy_v13_fixed.cedar").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def entities():
    return json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def scenario_suite():
    return json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def contracts():
    return [
        {
            "id": "SC-01",
            "title": "Admin Full Access",
            "severity": "HIGH",
            "isBlocking": True,
            "scenarioIds": ["sc_01", "sc_02"],
            "expectedDecision": "ALLOW",
        },
        {
            "id": "SC-02",
            "title": "Editor Invoice Management",
            "severity": "HIGH",
            "isBlocking": True,
            "scenarioIds": ["sc_03", "sc_04"],
            "expectedDecision": "ALLOW",
        },
        {
            "id": "SC-03",
            "title": "Editor Invoice Deletion Prohibited",
            "severity": "CRITICAL",
            "isBlocking": True,
            "scenarioIds": ["sc_05"],
            "expectedDecision": "DENY",
        },
        {
            "id": "SC-04",
            "title": "Contractor Payroll Isolation",
            "severity": "CRITICAL",
            "isBlocking": True,
            "scenarioIds": ["sc_06"],
            "expectedDecision": "DENY",
        },
    ]


@pytest.fixture
def auth_env(monkeypatch):
    """Enforces fail-closed token requirements while allowing test Bearer tokens in dev mode."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")
    return {
        "viewer": create_token_for_testing(sub="usr_view_01", username="auditor_viewer", roles=["viewer"]),
        "engineer": create_token_for_testing(sub="usr_eng_01", username="alice_eng", roles=["engineer"]),
        "approver": create_token_for_testing(sub="usr_appr_01", username="bob_approver", roles=["approver"]),
        "deployer": create_token_for_testing(sub="usr_depl_01", username="charlie_deployer", roles=["deployer"]),
        "admin": create_token_for_testing(sub="usr_admin_01", username="diana_admin", roles=["admin"]),
    }


# ==============================================================================
# Stage A: Application Health & Cedar Engine Connectivity
# ==============================================================================

def test_stage_a_health_and_engine_connectivity():
    """Stage A: Asserts root metadata and Cedar WASM health check."""
    root_res = client.get("/")
    assert root_res.status_code == 200
    root_data = root_res.json()
    assert root_data["status"] == "online"
    assert "Cedar" in root_data["engine"]

    health_res = client.get("/health")
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["status"] == "healthy"
    assert "cedarVersion" in health_data
    assert "cedarLangVersion" in health_data
    assert "credentialsDetected" in health_data


# ==============================================================================
# Stage B: Cognito Authentication & JWT Enforcement
# ==============================================================================

def test_stage_b_cognito_auth_and_jwt_enforcement(auth_env):
    """Stage B: Enforces fail-closed token validation on protected endpoints."""
    # 1. Missing Authorization header fails with 401
    unauth_res = client.get("/aws/status")
    assert unauth_res.status_code == 401
    assert "Missing bearer token" in unauth_res.json()["detail"]

    # 2. Malformed token fails with 401
    bad_token_res = client.get("/aws/status", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert bad_token_res.status_code == 401

    # 3. Valid authenticated token succeeds with 200
    auth_res = client.get("/aws/status", headers={"Authorization": f"Bearer {auth_env['viewer']}"})
    assert auth_res.status_code == 200
    assert "services" in auth_res.json()


# ==============================================================================
# Stage C: Role-Based Access Control (RBAC) Matrix
# ==============================================================================

def test_stage_c_rbac_matrix_enforcement(auth_env, candidate_v13_fixed):
    """Stage C: Verifies least-privilege role boundaries across mutation endpoints."""
    # Viewer role CANNOT record policy versions (requires engineer or admin)
    viewer_record_res = client.post(
        "/policies/set_acmepay/versions",
        json={
            "versionTag": "v_test_rbac",
            "policyText": candidate_v13_fixed,
            "author": "auditor_viewer",
            "changeSummary": "Unauthorized mutation attempt",
        },
        headers={"Authorization": f"Bearer {auth_env['viewer']}"},
    )
    assert viewer_record_res.status_code == 403

    # Engineer role CAN record policy versions
    eng_record_res = client.post(
        "/policies/set_acmepay/versions",
        json={
            "versionTag": "v_test_rbac_ok",
            "policyText": candidate_v13_fixed,
            "author": "alice_eng",
            "changeSummary": "Authorized engineer version record",
        },
        headers={"Authorization": f"Bearer {auth_env['engineer']}"},
    )
    assert eng_record_res.status_code == 200

    # Viewer role CANNOT approve deployments (requires approver or admin)
    viewer_appr_res = client.post(
        "/deployment/approve",
        json={
            "candidatePolicyHashSha256": "fakehash123",
            "targetEnv": "production",
            "approverName": "Viewer Impersonator",
        },
        headers={"Authorization": f"Bearer {auth_env['viewer']}"},
    )
    assert viewer_appr_res.status_code == 403

    # Engineer role CANNOT approve deployments
    eng_appr_res = client.post(
        "/deployment/approve",
        json={
            "candidatePolicyHashSha256": "fakehash123",
            "targetEnv": "production",
            "approverName": "Alice Engineer",
        },
        headers={"Authorization": f"Bearer {auth_env['engineer']}"},
    )
    assert eng_appr_res.status_code == 403

    # Viewer role CANNOT submit deployments (requires deployer or admin)
    viewer_submit_res = client.post(
        "/deployment/submit",
        json={
            "candidatePolicyText": candidate_v13_fixed,
            "approvalToken": "appr_fake",
            "targetEnv": "production",
        },
        headers={"Authorization": f"Bearer {auth_env['viewer']}"},
    )
    assert viewer_submit_res.status_code == 403


# ==============================================================================
# Stage D: Cedar Policy Validation & Evaluation
# ==============================================================================

def test_stage_d_cedar_validation_and_evaluation(baseline_v12, entities):
    """Stage D: Validates valid & invalid Cedar policies and single evaluation decisions."""
    # 1. Valid policy validation
    val_ok = client.post("/policies/validate", json={"policyText": baseline_v12})
    assert val_ok.status_code == 200
    assert val_ok.json()["isValid"] is True

    # 2. Syntax-invalid policy fails closed
    val_bad = client.post("/policies/validate", json={"policyText": "permit(principal == User::\"alice\", action, resource) bad token syntax"})
    assert val_bad.status_code == 200
    bad_data = val_bad.json()
    assert bad_data["isValid"] is False
    assert len(bad_data["errors"]) > 0

    # 3. Single scenario evaluation under baseline: Editor view invoice -> ALLOW
    sim_allow = client.post(
        "/simulate",
        json={
            "principal": 'User::"editor_bob"',
            "action": 'Action::"view"',
            "resource": 'Invoice::"inv_9082"',
            "context": {},
            "policyText": baseline_v12,
            "entities": entities,
        },
    )
    assert sim_allow.status_code == 200
    assert sim_allow.json()["decision"] == "ALLOW"

    # 4. Single scenario evaluation under baseline: Contractor delete payroll -> DENY
    sim_deny = client.post(
        "/simulate",
        json={
            "principal": 'User::"contractor_alice"',
            "action": 'Action::"delete"',
            "resource": 'PayrollReport::"payroll_2026_q1"',
            "context": {},
            "policyText": baseline_v12,
            "entities": entities,
        },
    )
    assert sim_deny.status_code == 200
    assert sim_deny.json()["decision"] == "DENY"


# ==============================================================================
# Stage E: Semantic Diff, Blast Radius & Counterexample Replay
# ==============================================================================

def test_stage_e_semantic_diff_and_counterexample_replay(baseline_v12, candidate_v13, entities, scenario_suite):
    """Stage E: Tests semantic diffing, blast radius impact, and counterexample replay."""
    # 1. Compute behavioral diff
    diff_res = client.post(
        "/policies/diff",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
        },
    )
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert diff_data["impactSummary"]["newlyAuthorizedCount"] == 2
    assert diff_data["impactSummary"]["deltaActions"] >= 1

    # 2. Extract concrete counterexamples
    cx_res = client.post(
        "/policies/counterexamples",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
        },
    )
    assert cx_res.status_code == 200
    cxs = cx_res.json()
    assert len(cxs) >= 2
    cx_05 = next(c for c in cxs if c["scenarioId"] == "sc_05")
    assert cx_05["transition"] == "NEWLY_AUTHORIZED"

    # 3. Counterexample Replay Verification
    replay_res = client.post(
        "/counterexamples/replay",
        json={
            "counterexample": cx_05,
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
        },
    )
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert replay_data["isReproduced"] is True
    assert replay_data["replayedBaselineDecision"] == "DENY"
    assert replay_data["replayedCandidateDecision"] == "ALLOW"
    assert replay_data["replayedTransition"] == "NEWLY_AUTHORIZED"


# ==============================================================================
# Stage F: Security Contracts & Automated Regression Gate
# ==============================================================================

def test_stage_f_security_contracts_and_regression_gate(
    baseline_v12, candidate_v13, candidate_v13_fixed, entities, scenario_suite, contracts
):
    """Stage F: Evaluates contracts and proves gate BLOCKED for v13 and PASS for v13_fixed."""
    # 1. Invariant contracts under candidate v13 fail critical SC-03
    eval_violating = client.post(
        "/contracts/evaluate",
        json={
            "policyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": contracts,
        },
    )
    assert eval_violating.status_code == 200
    violating_data = eval_violating.json()
    assert violating_data["allBlockingPassed"] is False
    sc03 = next(c for c in violating_data["results"] if c["contractId"] == "SC-03")
    assert sc03["status"] == "FAIL"

    # 2. Automated regression run on v13 yields BLOCKED gate
    reg_v13 = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": contracts,
        },
    )
    assert reg_v13.status_code == 200
    v13_report = reg_v13.json()
    assert v13_report["gateDecision"]["status"] == "BLOCKED"
    assert v13_report["gateDecision"]["isPassing"] is False
    assert v13_report["gateDecision"]["blockingViolationsCount"] > 0

    # 3. Corrected policy v13_fixed satisfies all invariants and passes gate
    reg_fixed = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13_fixed,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": contracts,
        },
    )
    assert reg_fixed.status_code == 200
    fixed_report = reg_fixed.json()
    assert fixed_report["gateDecision"]["status"] == "PASS"
    assert fixed_report["gateDecision"]["isPassing"] is True
    assert fixed_report["gateDecision"]["blockingViolationsCount"] == 0


# ==============================================================================
# Stage G: Strands PolicyAuditAgent Orchestration & Retrieval
# ==============================================================================

def test_stage_g_strands_agent_audit_and_retrieval(
    baseline_v12, candidate_v13, entities, scenario_suite, contracts
):
    """Stage G: Runs multi-stage Strands agent audit, validates tool invocations, and retrieves report."""
    run_res = client.post(
        "/audits/agent-run",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "suite": scenario_suite,
            "contracts": contracts,
            "entities": entities,
            "runAiExplanation": True,
        },
    )
    assert run_res.status_code == 200
    report = run_res.json()
    assert "auditRunId" in report
    assert report["gateDecision"] == "BLOCKED"
    assert len(report["toolInvocations"]) >= 5

    # Verify tool invocation traces
    tool_names = [inv["tool"] for inv in report["toolInvocations"]]
    assert "validate_policy" in tool_names
    assert "run_regression_suite" in tool_names
    assert "grounded_bedrock_explanation" in tool_names

    # Retrieve audit report by ID
    get_res = client.get(f"/audits/{report['auditRunId']}")
    assert get_res.status_code == 200
    assert get_res.json()["auditRunId"] == report["auditRunId"]


# ==============================================================================
# Stage H: Structured Audit Report Export (Markdown & JSON)
# ==============================================================================

def test_stage_h_audit_report_export(
    baseline_v12, candidate_v13_fixed, entities, scenario_suite, contracts
):
    """Stage H: Exports structured audit report in Markdown and JSON formats."""
    # Obtain a passing report
    audit_res = client.post(
        "/audits/agent-run",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13_fixed,
            "suite": scenario_suite,
            "contracts": contracts,
            "entities": entities,
            "runAiExplanation": False,
        },
    )
    report = audit_res.json()

    # 1. Export as Markdown
    md_res = client.post(
        "/audits/export",
        json={"report": report, "format": "markdown"},
    )
    assert md_res.status_code == 200
    md_data = md_res.json()
    assert md_data["format"] == "markdown"
    assert "# PolicyLab Formal Authorization Audit Report" in md_data["content"]
    assert "PolicyAuditAgent" in md_data["content"]

    # 2. Export as JSON
    json_res = client.post(
        "/audits/export",
        json={"report": report, "format": "json"},
    )
    assert json_res.status_code == 200
    json_data = json_res.json()
    assert json_data["format"] == "json"
    parsed = json.loads(json_data["content"])
    assert parsed["auditRunId"] == report["auditRunId"]


# ==============================================================================
# Stage I: Human Approval & Tampering Invalidation
# ==============================================================================

def test_stage_i_human_approval_and_tampering_invalidation(
    baseline_v12, candidate_v13_fixed, entities, scenario_suite, contracts
):
    """Stage I: Proves cryptographic binding between human approval and policy text."""
    # 1. Run regression on valid candidate
    reg_res = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13_fixed,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": contracts,
        },
    )
    reg_report = reg_res.json()

    # 2. Prepare deployment
    prep_res = client.post(
        "/deployment/prepare",
        json={
            "candidatePolicyText": candidate_v13_fixed,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
            "regressionReport": reg_report,
        },
    )
    prep_data = prep_res.json()
    assert prep_data["isEligible"] is True

    # 3. Register human approval
    appr_res = client.post(
        "/deployment/approve",
        json={
            "preparedDeploymentId": prep_data["preparedDeploymentId"],
            "policyHash": prep_data["policyHash"],
            "regressionRunId": reg_report["runId"],
            "operatorName": "Sneha (Principal Security Architect)",
            "approvalNotes": "Invariant suite clean. Approved for production.",
        },
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "APPROVED"

    # 4. Tamper candidate text: submission MUST be rejected
    tampered_policy = candidate_v13_fixed + "\n// Injected unauthorized permit"
    submit_tampered = client.post(
        "/deployment/submit",
        json={
            "preparedDeploymentId": prep_data["preparedDeploymentId"],
            "approvalId": appr_data["approvalId"],
            "candidatePolicyText": tampered_policy,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
        },
    )
    assert submit_tampered.status_code == 400
    assert "modified since human approval was granted" in submit_tampered.json()["detail"]


# ==============================================================================
# Stage J: Deployment Submission & Remote State Verification
# ==============================================================================

def test_stage_j_deployment_submission_and_remote_verification(
    baseline_v12, candidate_v13_fixed, entities, scenario_suite, contracts
):
    """Stage J: Submits valid approved policy and verifies ledger recording."""
    reg_res = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13_fixed,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": contracts,
        },
    )
    reg_report = reg_res.json()

    prep_res = client.post(
        "/deployment/prepare",
        json={
            "candidatePolicyText": candidate_v13_fixed,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
            "regressionReport": reg_report,
        },
    )
    prep_data = prep_res.json()

    appr_res = client.post(
        "/deployment/approve",
        json={
            "preparedDeploymentId": prep_data["preparedDeploymentId"],
            "policyHash": prep_data["policyHash"],
            "regressionRunId": reg_report["runId"],
            "operatorName": "Vishal (Lead Security Engineer)",
        },
    )
    appr_data = appr_res.json()

    # Submit valid deployment
    sub_res = client.post(
        "/deployment/submit",
        json={
            "preparedDeploymentId": prep_data["preparedDeploymentId"],
            "approvalId": appr_data["approvalId"],
            "candidatePolicyText": candidate_v13_fixed,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
        },
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] in (DeploymentStatus.SYNCHRONIZED, DeploymentStatus.SUBMITTED)
    assert sub_data["policyHash"] == prep_data["policyHash"]

    # Verify ledger history
    history_res = client.get("/deployment/history")
    assert history_res.status_code == 200
    records = history_res.json()
    assert len(records) >= 1
    assert any(r["policyHash"] == prep_data["policyHash"] for r in records)


# ==============================================================================
# Stage K: Persistence Integrity (Conditional Writes & S3 Digests)
# ==============================================================================

def test_stage_k_persistence_conditional_writes_and_s3_digests():
    """Stage K: Tests repository conditional write conflict prevention and S3 SHA-256 integrity."""
    from backend.domain.persistence.aws_repository import (
        DynamoDBPolicyLabRepository,
        PolicyVersionConflictError,
        S3ArtifactIntegrityError,
        S3ArtifactRepository,
    )

    # 1. DynamoDB single-table conditional write conflict prevention
    repo = DynamoDBPolicyLabRepository(table_name="PolicyLab-test")
    test_version = {
        "setId": "set_integrity_01",
        "versionTag": "v1.0",
        "policyHash": "hash_aaa",
        "author": "tester",
        "changeSummary": "Initial baseline",
    }
    repo.save_policy_version(test_version)

    # Overwriting same version tag must raise conflict error
    with pytest.raises(PolicyVersionConflictError):
        repo.save_policy_version(test_version)

    # 2. S3 Artifact SHA-256 integrity verification
    s3_repo = S3ArtifactRepository(bucket_name="policylab-test-bucket")
    content = "permit(principal, action, resource);"
    expected_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    # Matching hash succeeds
    stored = s3_repo.store_artifact("test/policy.cedar", content, expected_sha256=expected_hash)
    assert stored["sha256"] == expected_hash

    # Tampered expected hash fails closed
    with pytest.raises(S3ArtifactIntegrityError):
        s3_repo.store_artifact("test/bad.cedar", content, expected_sha256="corrupted_hash_value")


# ==============================================================================
# Stage L: Step Functions Execution & Status Retrieval (Fail-Closed)
# ==============================================================================

def test_stage_l_step_functions_fail_closed_handling(baseline_v12, candidate_v13, scenario_suite):
    """Stage L: Proves Step Functions endpoint returns informative diagnostic errors when unconfigured."""
    # When AUDIT_STATE_MACHINE_ARN is missing
    async_res = client.post(
        "/audits/async-run",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "suite": scenario_suite,
        },
    )
    # Returns 400 Bad Request explaining that AUDIT_STATE_MACHINE_ARN must be set
    # and directing caller to synchronous /audits/agent-run
    assert async_res.status_code == 400
    assert "AUDIT_STATE_MACHINE_ARN" in async_res.json()["detail"]
    assert "/audits/agent-run" in async_res.json()["detail"]
