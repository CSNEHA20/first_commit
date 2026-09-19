"""
AcmePay End-to-End Demonstration Test
Demonstrates the full 12-step verification lifecycle:
1. Baseline policy (v12) with expected least-privilege permissions.
2. Candidate policy (v13) with accidental authorization expansion (editor delete invoice).
3. Input validation against Cedar parser and schema.
4. Evaluation across declared scenario suite.
5. Behavioral comparison and blast radius calculation.
6. Counterexample extraction highlighting the concrete regression tuple.
7. Security contract verification detecting prohibited invariant violation (SC-03).
8. Regression report compilation linking contract failure to the counterexample.
9. Pre-deployment gate calculation yielding BLOCKED status.
10. Corrected candidate policy (v13-fixed) addressing the regression.
11. Rerun of regression evaluation against corrected candidate.
12. Pre-deployment gate calculation yielding PASS status with 0 blocking violations.
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
def schema_text():
    with open(FIXTURES_DIR / "schema.cedarschema.json", "r") as f:
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
def acmepay_security_contracts():
    return [
        {
            "id": "SC-01",
            "title": "Admin Administrative Access",
            "description": "Admins retain full administrative deletion permissions across resources.",
            "severity": "HIGH",
            "isBlocking": True,
            "contractType": "INVARIANT_PERMITTED",
            "scenarioIds": ["sc_01", "sc_02"],
            "expectedDecision": "ALLOW",
        },
        {
            "id": "SC-02",
            "title": "Editor Invoice Management",
            "description": "Editors are permitted to view and edit invoices.",
            "severity": "HIGH",
            "isBlocking": True,
            "contractType": "INVARIANT_PERMITTED",
            "scenarioIds": ["sc_03", "sc_04"],
            "expectedDecision": "ALLOW",
        },
        {
            "id": "SC-03",
            "title": "Editor Invoice Deletion Prohibited",
            "description": "Editors must never be permitted to delete invoice records.",
            "severity": "CRITICAL",
            "isBlocking": True,
            "contractType": "INVARIANT_DENIED",
            "scenarioIds": ["sc_05"],
            "expectedDecision": "DENY",
        },
        {
            "id": "SC-04",
            "title": "Contractor Payroll Deletion Prohibited",
            "description": "External contractors must never delete payroll records.",
            "severity": "CRITICAL",
            "isBlocking": True,
            "contractType": "INVARIANT_DENIED",
            "scenarioIds": ["sc_06"],
            "expectedDecision": "DENY",
        },
    ]


def test_acmepay_12_step_e2e_regression_demonstration(
    baseline_v12,
    candidate_v13,
    candidate_v13_fixed,
    schema_text,
    entities,
    scenario_suite,
    acmepay_security_contracts,
):
    # Step 1: Baseline Policy (v12) loaded with expected least-privilege permissions.
    assert "Role::\"admin\"" in baseline_v12
    assert "forbid" in baseline_v12

    # Step 2: Candidate Policy (v13) loaded with intentional authorization expansion.
    assert "Action::\"delete\"" in candidate_v13

    # Step 3: Validate syntax and schema compatibility of both policies.
    val_base = client.post("/policies/validate", json={"policyText": baseline_v12})
    assert val_base.status_code == 200
    assert val_base.json()["isValid"] is True

    val_cand = client.post("/policies/validate", json={"policyText": candidate_v13})
    assert val_cand.status_code == 200
    assert val_cand.json()["isValid"] is True

    # Step 4: Batch evaluation of scenarios against baseline.
    batch_base = client.post(
        "/simulate/batch",
        json={"policyText": baseline_v12, "entities": entities, "suite": scenario_suite},
    )
    assert batch_base.status_code == 200
    assert batch_base.json()["status"] == "COMPLETED"
    assert batch_base.json()["failedExpectationsCount"] == 0  # 100% pass on baseline

    # Step 5: Diff comparison between baseline and candidate v13.
    diff_resp = client.post(
        "/policies/diff",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
            "baselineLabel": "v12 (PROD)",
            "candidateLabel": "v13 (Draft)",
        },
    )
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert diff_data["impactSummary"]["newlyAuthorizedCount"] == 2
    assert diff_data["impactSummary"]["newlyForbiddenCount"] == 0

    # Step 6: Counterexample extraction for newly authorized regressions.
    cx_resp = client.post(
        "/policies/counterexamples",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
        },
    )
    assert cx_resp.status_code == 200
    counterexamples = cx_resp.json()
    assert len(counterexamples) == 2
    cx_05 = next(cx for cx in counterexamples if cx["scenarioId"] == "sc_05")
    assert cx_05["principal"] == 'User::"editor_bob"'
    assert cx_05["action"] == 'Action::"delete"'
    assert cx_05["resource"] == 'Invoice::"inv_9082"'
    assert cx_05["transition"] == "NEWLY_AUTHORIZED"

    # Step 7: Security contract evaluation against candidate v13.
    contracts_resp = client.post(
        "/contracts/evaluate",
        json={
            "policyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": acmepay_security_contracts,
        },
    )
    assert contracts_resp.status_code == 200
    contracts_report = contracts_resp.json()
    assert contracts_report["failedContracts"] == 1
    assert contracts_report["allBlockingPassed"] is False
    sc03_res = next(r for r in contracts_report["results"] if r["contractId"] == "SC-03")
    assert sc03_res["status"] == "FAIL"

    # Step 8: Full regression run combining diff, counterexamples, and contracts.
    reg_resp = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": acmepay_security_contracts,
            "baselineLabel": "v12 (PROD)",
            "candidateLabel": "v13 (Draft)",
        },
    )
    assert reg_resp.status_code == 200
    reg_report = reg_resp.json()

    # Step 9: Pre-deployment verification gate BLOCKED due to SC-03 failure.
    assert reg_report["gateDecision"]["status"] == "BLOCKED"
    assert reg_report["gateDecision"]["isPassing"] is False
    assert reg_report["gateDecision"]["blockingViolationsCount"] == 1
    assert any("SC-03" in r for r in reg_report["gateDecision"]["reasons"])
    assert reg_report["gateDecision"]["requiresHumanApproval"] is True

    # Step 10: Corrected candidate policy (v13-fixed) prepared.
    val_fixed = client.post("/policies/validate", json={"policyText": candidate_v13_fixed})
    assert val_fixed.status_code == 200
    assert val_fixed.json()["isValid"] is True

    # Step 11: Rerun regression against corrected candidate policy.
    reg_fixed_resp = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": baseline_v12,
            "candidatePolicyText": candidate_v13_fixed,
            "entities": entities,
            "suite": scenario_suite,
            "contracts": acmepay_security_contracts,
            "baselineLabel": "v12 (PROD)",
            "candidateLabel": "v13 (Fixed)",
        },
    )
    assert reg_fixed_resp.status_code == 200
    reg_fixed_report = reg_fixed_resp.json()

    # Step 12: Pre-deployment gate PASSES with 0 contract violations.
    assert reg_fixed_report["gateDecision"]["status"] == "PASS"
    assert reg_fixed_report["gateDecision"]["isPassing"] is True
    assert reg_fixed_report["gateDecision"]["blockingViolationsCount"] == 0
    assert len(reg_fixed_report["counterexamples"]) == 0
    assert all(c["status"] == "PASS" for c in reg_fixed_report["contractResults"])
    assert reg_fixed_report["gateDecision"]["requiresHumanApproval"] is True
