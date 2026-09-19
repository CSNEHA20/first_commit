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

    # Step 7: Security contract verification detecting violation
    contract_res = client.post("/contracts/evaluate", json={
        "policyText": candidate_v13,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert contract_res.status_code == 200
    contract_data = contract_res.json()
    assert contract_data["allBlockingPassed"] is False

    # Step 8: Full regression run yielding BLOCKED gate
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

    # Step 9: Request grounded AI explanation using evidence
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

    # Step 10: Verify explanation references & limitations
    assert cx_05["id"] in expl_data["evidenceReferences"]
    assert "SC-03" in expl_data["evidenceReferences"]
    assert "Explanation is strictly" in expl_data["limitations"]

    # Step 11: Present proposed Cedar remediation
    assert "permit (" in expl_data["remediationCedar"]

    # Step 12: Incorporate candidate correction (candidate_policy_v13_fixed)
    val_fixed = client.post("/policies/validate", json={"policyText": candidate_v13_fixed})
    assert val_fixed.status_code == 200
    assert val_fixed.json()["isValid"] is True

    # Step 13: Rerun regression with corrected policy
    reg_fixed_res = client.post("/policies/regression", json={
        "baselinePolicyText": baseline_v12,
        "candidatePolicyText": candidate_v13_fixed,
        "entities": entities,
        "suite": scenario_suite,
        "contracts": acmepay_contracts,
    })
    assert reg_fixed_res.status_code == 200
    reg_fixed_report = reg_fixed_res.json()

    # Step 14: Verify gate status is PASS
    assert reg_fixed_report["gateDecision"]["status"] == "PASS"
    assert reg_fixed_report["gateDecision"]["isPassing"] is True
    assert reg_fixed_report["gateDecision"]["blockingViolationsCount"] == 0

    # Step 15: Check AVP deployment readiness
    readiness_res = client.get("/deployment/readiness?region=us-east-1&store_id=ps-acmepay-prod")
    assert readiness_res.status_code == 200
    assert readiness_res.json()["isConfigured"] is True

    # Step 16: Prepare deployment & register human operator approval
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

    # Step 17: Submit deployment to AVP
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
