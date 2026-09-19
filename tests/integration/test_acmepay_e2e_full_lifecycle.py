"""
AcmePay Full End-to-End Verification & Deployment Lifecycle Test
Demonstrates the complete 17-step PolicyLab workflow:
1. Load baseline policy (v12) with least-privilege permissions.
2. Load candidate policy (v13) with intentional authorization expansion (editor delete invoice).
3. Validate policy syntax against Cedar WASM validator.
4. Evaluate both versions across declared scenario suite and shared entity graph.
5. Compute behavioral diff and bounded blast radius.
6. Extract concrete counterexample (cx_sc_05).
7. Detect security contract violation (SC-03).
8. Compile regression report with BLOCKED pre-deployment gate.
9. Request grounded AI explanation using deterministic evidence payload.
10. Verify explanation contains traceable evidence references and limitations disclaimer.
11. Inspect proposed Cedar remediation suggestion.
12. Incorporate correction (candidate_policy_v13_fixed.cedar).
13. Rerun validation, diff, counterexamples, contracts, and regression.
14. Verify new gate result is PASS with 0 blocking violations.
15. Inspect Amazon Verified Permissions deployment readiness.
16. Prepare deployment plan and register explicit human operator approval.
17. Submit approved policy to AVP target store, verifying SYNCHRONIZED status and audit proof.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def baseline_v12():
    with open(FIXTURES_DIR / "valid_policy.cedar", "r") as f:
        return f.read()


@pytest.fixture
def candidate_v13():
    with open(FIXTURES_DIR / "candidate_policy_v13.cedar", "r") as f:
        return f.read()


@pytest.fixture
def candidate_v13_fixed():
    with open(FIXTURES_DIR / "candidate_policy_v13_fixed.cedar", "r") as f:
        return f.read()


@pytest.fixture
def entities():
    with open(FIXTURES_DIR / "entities.json", "r") as f:
        return json.load(f)


@pytest.fixture
def scenario_suite():
    with open(FIXTURES_DIR / "scenarios.json", "r") as f:
        return json.load(f)


@pytest.fixture
def acmepay_contracts():
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


def test_acmepay_17_step_full_lifecycle(
    baseline_v12,
    candidate_v13,
    candidate_v13_fixed,
    entities,
    scenario_suite,
    acmepay_contracts,
):
    # Step 1: Baseline policy loaded
    assert "Role::\"admin\"" in baseline_v12

    # Step 2: Candidate policy with intentional regression loaded
    assert "Action::\"delete\"" in candidate_v13

    # Step 3: Validate Cedar syntax
    val_res = client.post("/policies/validate", json={"policyText": candidate_v13})
    assert val_res.status_code == 200
    assert val_res.json()["isValid"] is True

    # Step 4: Batch scenario evaluation
    sim_res = client.post("/simulate/batch", json={"policyText": candidate_v13, "entities": entities, "suite": scenario_suite})
    assert sim_res.status_code == 200
    assert sim_res.json()["status"] == "COMPLETED"

    # Step 5: Behavioral comparison & bounded impact
    diff_res = client.post("/policies/diff", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
    })
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert diff_data["impactSummary"]["newlyAuthorizedCount"] == 2

    # Step 6: Extract concrete counterexample
    cx_res = client.post("/policies/counterexamples", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
    })
    assert cx_res.status_code == 200
    counterexamples = cx_res.json()
    cx_05 = next(c for c in counterexamples if c["scenarioId"] == "sc_05")
    assert cx_05["transition"] == "NEWLY_AUTHORIZED"

    # Step 6.5 / Step 7: Deterministic counterexample replay verification
    replay_res = client.post("/counterexamples/replay", json={
        "counterexample": cx_05,
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13,
        "entities": entities,
    })
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert replay_data["isReproduced"] is True
    assert replay_data["replayedBaselineDecision"] == "DENY"
    assert replay_data["replayedCandidateDecision"] == "ALLOW"
    assert replay_data["replayedTransition"] == "NEWLY_AUTHORIZED"

    # Step 8: Security contract verification detecting violation
    contract_res = client.post("/contracts/evaluate", json={
        "policyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert contract_res.status_code == 200
    contract_data = contract_res.json()
    assert contract_data["allBlockingPassed"] is False

    # Step 9: Full regression run yielding BLOCKED gate
    reg_res = client.post("/policies/regression", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert reg_res.status_code == 200
    reg_report = reg_res.json()
    assert reg_report["gateDecision"]["status"] == "BLOCKED"
    assert reg_report["gateDecision"]["isPassing"] is False

    # Step 10: Request grounded AI explanation using evidence
    expl_payload = {
        "findingId": cx_05["id"],
        "scenarioId": cx_05["scenarioId"],
        "scenarioTitle": cx_05["scenarioTitle"],
        "principal": cx_05["principal"],
        "action": cx_05["action"],
        "resource": cx_05["resource"],
        "context": cx_05["context"],
        "baselineDecision": cx_05["baselineDecision"],
        "candidateDecision": cx_05["candidateDecision"],
        "transition": cx_05["transition"],
        "determiningPolicies": cx_05["candidateDeterminingPolicies"],
        "violatedContractId": "SC-03",
        "violatedContractTitle": "Editor Invoice Deletion Prohibited",
        "regressionRunId": reg_report["runId"],
    }
    expl_res = client.post("/explanations", json=expl_payload)
    assert expl_res.status_code == 200
    expl_data = expl_res.json()

    # Step 11: Verify explanation references & limitations
    assert cx_05["id"] in expl_data["evidenceReferences"]
    assert "SC-03" in expl_data["evidenceReferences"]
    assert "Explanation is strictly" in expl_data["limitations"]

    # Step 12: Present proposed Cedar remediation
    assert "permit (" in expl_data["remediationCedar"]

    # Step 13: Incorporate candidate correction (candidate_policy_v13_fixed)
    val_fixed = client.post("/policies/validate", json={"policyText": candidate_v13_fixed})
    assert val_fixed.status_code == 200
    assert val_fixed.json()["isValid"] is True

    # Step 14: Rerun regression with corrected policy
    reg_fixed_res = client.post("/policies/regression", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13_fixed,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert reg_fixed_res.status_code == 200
    reg_fixed_report = reg_fixed_res.json()

    # Step 15: Verify gate status is PASS
    assert reg_fixed_report["gateDecision"]["status"] == "PASS"
    assert reg_fixed_report["gateDecision"]["isPassing"] is True
    assert reg_fixed_report["gateDecision"]["blockingViolationsCount"] == 0

    # Step 16: Check AVP deployment readiness
    readiness_res = client.get("/deployment/readiness?region=us-east-1&store_id=ps-acmepay-prod")
    assert readiness_res.status_code == 200
    assert readiness_res.json()["isConfigured"] is True

    # Step 17: Prepare deployment & register human operator approval
    prep_res = client.post("/deployment/prepare", json={
        "candidatePolicyText": candidate_v13_fixed,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
        "regressionReport": reg_fixed_report,
    })
    assert prep_res.status_code == 200
    prep_data = prep_res.json()
    assert prep_data["isEligible"] is True

    appr_res = client.post("/deployment/approve", json={
        "preparedDeploymentId": prep_data["preparedDeploymentId"],
        "policyHash": prep_data["policyHash"],
        "regressionRunId": reg_fixed_report["runId"],
        "operatorName": "Vishal (Lead Security Engineer)",
        "approvalNotes": "Regression suite passed 100% of invariant checks",
    })
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "APPROVED"

    # Step 18: Submit deployment to AVP
    submit_res = client.post("/deployment/submit", json={
        "preparedDeploymentId": prep_data["preparedDeploymentId"],
        "approvalId": appr_data["approvalId"],
        "candidatePolicyText": candidate_v13_fixed,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
    })
    assert submit_res.status_code == 200
    submit_data = submit_res.json()
    assert submit_data["status"] == "SYNCHRONIZED"
    assert "avp-sync-proof" in submit_data["verificationProof"]


def test_acmepay_e2e_negative_and_failure_cases(
    baseline_v12,
    candidate_v13,
    candidate_v13_fixed,
    entities,
    scenario_suite,
    acmepay_contracts,
):
    """
    Negative and failure injection tests for the complete PolicyLab workflow:
    1. Rejection of human approval for BLOCKED candidate
    2. Rejection of submission with forged approval token
    3. Rejection of submission when policy is tampered with after human approval
    4. Fail-closed behavior on syntax-invalid Cedar policy
    5. Truthful AWS status reporting without secret exposure
    """
    # 1. Regression run for violating candidate yields BLOCKED gate
    reg_blocked_res = client.post("/policies/regression", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert reg_blocked_res.status_code == 200
    reg_blocked_report = reg_blocked_res.json()
    assert reg_blocked_report["gateDecision"]["status"] == "BLOCKED"

    # 2. Preparing deployment for BLOCKED candidate marks it ineligible
    prep_blocked = client.post("/deployment/prepare", json={
        "candidatePolicyText": candidate_v13,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
        "regressionReport": reg_blocked_report,
    })
    assert prep_blocked.status_code == 200
    prep_blocked_data = prep_blocked.json()
    assert prep_blocked_data["isEligible"] is False

    # 3. Attempting to approve an ineligible deployment raises 400
    appr_blocked = client.post("/deployment/approve", json={
        "preparedDeploymentId": prep_blocked_data["preparedDeploymentId"],
        "policyHash": prep_blocked_data["policyHash"],
        "regressionRunId": reg_blocked_report["runId"],
        "operatorName": "Attacker",
    })
    assert appr_blocked.status_code == 400
    assert "BLOCKED" in appr_blocked.json()["detail"]

    # 4. Prepare and approve valid candidate
    reg_pass_res = client.post("/policies/regression", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13_fixed,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    reg_pass_report = reg_pass_res.json()

    prep_valid = client.post("/deployment/prepare", json={
        "candidatePolicyText": candidate_v13_fixed,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
        "regressionReport": reg_pass_report,
    })
    prep_valid_data = prep_valid.json()

    appr_valid = client.post("/deployment/approve", json={
        "preparedDeploymentId": prep_valid_data["preparedDeploymentId"],
        "policyHash": prep_valid_data["policyHash"],
        "regressionRunId": reg_pass_report["runId"],
        "operatorName": "Sneha (Lead Architect)",
    })
    appr_valid_data = appr_valid.json()
    assert appr_valid_data["status"] == "APPROVED"

    # 5. Submission with forged approval ID raises 400
    submit_forged = client.post("/deployment/submit", json={
        "preparedDeploymentId": prep_valid_data["preparedDeploymentId"],
        "approvalId": "appr_forged_nonexistent_token",
        "candidatePolicyText": candidate_v13_fixed,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
    })
    assert submit_forged.status_code == 400
    assert "not found or expired" in submit_forged.json()["detail"]

    # 6. Submission with tampered policy text raises 400 (tampering invalidation)
    tampered_policy = candidate_v13_fixed + "\n// Tampered backdoor clause"
    submit_tampered = client.post("/deployment/submit", json={
        "preparedDeploymentId": prep_valid_data["preparedDeploymentId"],
        "approvalId": appr_valid_data["approvalId"],
        "candidatePolicyText": tampered_policy,
        "targetStoreId": "ps-acmepay-prod",
        "environment": "production",
    })
    assert submit_tampered.status_code == 400
    assert "modified since human approval was granted" in submit_tampered.json()["detail"]

    # 7. Malformed Cedar policy validation fails closed
    val_bad = client.post("/policies/validate", json={
        "policyText": "permit(principal == User::\"alice\", action, resource) invalid syntax here"
    })
    assert val_bad.status_code == 200
    assert val_bad.json()["isValid"] is False
    assert len(val_bad.json()["errors"]) > 0

    # 8. Truthful AWS status reporting
    status_res = client.get("/aws/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "services" in status_data
    assert "verified_permissions" in status_data["services"]
    assert "bedrock" in status_data["services"]
    assert "dynamodb" in status_data["services"]
    assert "s3" in status_data["services"]
    assert "step_functions" in status_data["services"]
    # Verify no credentials leaked in status response
    status_str = json.dumps(status_data)
    assert "AKIA" not in status_str
    assert "SecretAccessKey" not in status_str
