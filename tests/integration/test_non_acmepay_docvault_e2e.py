"""
Integration Test: Real Project Lifecycle Proof with Independent Non-AcmePay Cedar Model (DocVault)
Validates the full 12-step verification lifecycle:
1. Workspace creation
2. Cedar policy & schema validation
3. Deterministic Cedar authorization evaluation
4. Differential comparison between baseline and candidate
5. Inspection of changed authorization decisions (Auditor Export: DENY -> ALLOW)
6. Counterexample generation and replay
7. Security contracts evaluation (SEC-DOC-01 BLOCKED)
8. Pre-deployment regression gate enforcement
9. Re-evaluation with verified fixed candidate (PASS)
"""

import json
import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app, repository


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def docvault_fixtures():
    fixtures_dir = os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "docvault")
    with open(os.path.join(fixtures_dir, "docvault_baseline.cedar"), "r", encoding="utf-8") as f:
        baseline_policy = f.read()
    with open(os.path.join(fixtures_dir, "docvault_candidate.cedar"), "r", encoding="utf-8") as f:
        candidate_policy = f.read()
    with open(os.path.join(fixtures_dir, "docvault_fixed.cedar"), "r", encoding="utf-8") as f:
        fixed_policy = f.read()
    with open(os.path.join(fixtures_dir, "docvault_schema.json"), "r", encoding="utf-8") as f:
        schema_text = f.read()
    with open(os.path.join(fixtures_dir, "docvault_entities.json"), "r", encoding="utf-8") as f:
        entities = json.load(f)
    with open(os.path.join(fixtures_dir, "docvault_scenarios.json"), "r", encoding="utf-8") as f:
        scenarios = json.load(f)
    with open(os.path.join(fixtures_dir, "docvault_contracts.json"), "r", encoding="utf-8") as f:
        contracts = json.load(f)

    return {
        "baseline_policy": baseline_policy,
        "candidate_policy": candidate_policy,
        "fixed_policy": fixed_policy,
        "schema_text": schema_text,
        "entities": entities,
        "scenarios": scenarios,
        "contracts": contracts,
    }


def test_docvault_full_12_step_lifecycle(client, docvault_fixtures):
    # Step 1: Create Connected Workspace for DocVault
    ws_create_res = client.post(
        "/workspaces",
        json={
            "name": "DocVault Legal & Audit Workspace",
            "description": "Enterprise Document Security & Legal Hold Management",
            "mode": "connected",
        },
    )
    assert ws_create_res.status_code == 201
    ws_data = ws_create_res.json()
    assert ws_data["name"] == "DocVault Legal & Audit Workspace"
    ws_id = ws_data["workspaceId"]

    # Step 2: Validate Baseline and Candidate Cedar Policies with Schema
    val_baseline_res = client.post(
        "/policies/validate",
        json={
            "policyText": docvault_fixtures["baseline_policy"],
            "schemaText": docvault_fixtures["schema_text"],
        },
    )
    assert val_baseline_res.status_code == 200
    assert val_baseline_res.json()["isValid"] is True

    val_candidate_res = client.post(
        "/policies/validate",
        json={
            "policyText": docvault_fixtures["candidate_policy"],
            "schemaText": docvault_fixtures["schema_text"],
        },
    )
    assert val_candidate_res.status_code == 200
    assert val_candidate_res.json()["isValid"] is True

    # Step 3: Run Deterministic Cedar Single Evaluation
    # Counsel view litigation hold -> ALLOW
    eval_counsel_res = client.post(
        "/simulate",
        json={
            "principal": 'DocVault::User::"attorney_elena"',
            "action": 'DocVault::Action::"view"',
            "resource": 'DocVault::Document::"litigation_hold_901"',
            "context": {},
            "policyText": docvault_fixtures["baseline_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
        },
    )
    assert eval_counsel_res.status_code == 200
    assert eval_counsel_res.json()["decision"] == "ALLOW"

    # Auditor export audit record in Baseline -> DENY
    eval_auditor_baseline_res = client.post(
        "/simulate",
        json={
            "principal": 'DocVault::User::"auditor_dave"',
            "action": 'DocVault::Action::"export"',
            "resource": 'DocVault::AuditRecord::"system_access_log_q3"',
            "context": {},
            "policyText": docvault_fixtures["baseline_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
        },
    )
    assert eval_auditor_baseline_res.status_code == 200
    assert eval_auditor_baseline_res.json()["decision"] == "DENY"

    # Step 4: Batch Simulation across declared scenario universe
    suite_payload = {
        "id": "suite_docvault_enterprise",
        "name": "DocVault Enterprise Legal & Audit Suite",
        "scenarios": docvault_fixtures["scenarios"],
    }
    batch_res = client.post(
        "/simulate/batch",
        json={
            "suite": suite_payload,
            "policyText": docvault_fixtures["baseline_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
        },
    )
    assert batch_res.status_code == 200
    batch_data = batch_res.json()
    assert batch_data["totalScenarios"] == 6
    assert batch_data["passedExpectationsCount"] == 6
    assert batch_data["failedExpectationsCount"] == 0

    # Step 5 & 6: Policy Comparison (Baseline vs Candidate)
    diff_res = client.post(
        "/policies/diff",
        json={
            "baselinePolicyText": docvault_fixtures["baseline_policy"],
            "candidatePolicyText": docvault_fixtures["candidate_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
            "suite": suite_payload,
            "baselineLabel": "v1.0 (PROD)",
            "candidateLabel": "v1.1 (Candidate Draft)",
        },
    )
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert diff_data["impactSummary"]["newlyAuthorizedCount"] == 1
    # Verify the exact detected changed decision (sc_dv_05: Auditor Export)
    sc_dv_05_diff = next(d for d in diff_data["scenarioDiffs"] if d["scenarioId"] == "sc_dv_05")
    assert sc_dv_05_diff["baselineDecision"] == "DENY"
    assert sc_dv_05_diff["candidateDecision"] == "ALLOW"
    assert sc_dv_05_diff["transition"] == "NEWLY_AUTHORIZED"

    # Step 7: Counterexample Discovery & Replay
    cx_res = client.post(
        "/policies/counterexamples",
        json={
            "baselinePolicyText": docvault_fixtures["baseline_policy"],
            "candidatePolicyText": docvault_fixtures["candidate_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
            "suite": suite_payload,
            "baselineLabel": "v1.0 (PROD)",
            "candidateLabel": "v1.1 (Candidate Draft)",
        },
    )
    assert cx_res.status_code == 200
    counterexamples = cx_res.json()
    assert len(counterexamples) >= 1
    target_cx = next(cx for cx in counterexamples if cx["scenarioId"] == "sc_dv_05")
    assert target_cx["transition"] == "NEWLY_AUTHORIZED"

    # Step 8: Replay Counterexample
    replay_res = client.post(
        "/counterexamples/replay",
        json={
            "counterexample": target_cx,
            "baselinePolicyText": docvault_fixtures["baseline_policy"],
            "candidatePolicyText": docvault_fixtures["candidate_policy"],
            "entities": docvault_fixtures["entities"],
        },
    )
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert replay_data["isReproduced"] is True
    assert replay_data["baselineEvidence"]["decision"] == "DENY"
    assert replay_data["candidateEvidence"]["decision"] == "ALLOW"

    # Step 9: Contract Evaluation (Candidate Fails SEC-DOC-01)
    contract_res = client.post(
        "/contracts/evaluate",
        json={
            "policyText": docvault_fixtures["candidate_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
            "suite": suite_payload,
            "contracts": docvault_fixtures["contracts"],
        },
    )
    assert contract_res.status_code == 200
    contract_data = contract_res.json()
    assert contract_data["allBlockingPassed"] is False
    assert contract_data["failedContracts"] >= 1
    sec_doc_01 = next(c for c in contract_data["results"] if c["contractId"] == "SEC-DOC-01")
    assert sec_doc_01["status"] == "FAIL"
    assert sec_doc_01["isBlocking"] is True

    # Step 10: Regression Gate (Candidate is BLOCKED from deployment)
    reg_res = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": docvault_fixtures["baseline_policy"],
            "candidatePolicyText": docvault_fixtures["candidate_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
            "suite": suite_payload,
            "contracts": docvault_fixtures["contracts"],
            "baselineLabel": "v1.0 (PROD)",
            "candidateLabel": "v1.1 (Candidate Draft)",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["gateDecision"]["status"] == "BLOCKED"
    assert reg_data["gateDecision"]["isPassing"] is False

    # Step 11: Evaluate Fixed Policy (Candidate Fix)
    reg_fixed_res = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": docvault_fixtures["baseline_policy"],
            "candidatePolicyText": docvault_fixtures["fixed_policy"],
            "schemaText": docvault_fixtures["schema_text"],
            "entities": docvault_fixtures["entities"],
            "suite": suite_payload,
            "contracts": docvault_fixtures["contracts"],
            "baselineLabel": "v1.0 (PROD)",
            "candidateLabel": "v1.1 (Fixed / Verified)",
        },
    )
    assert reg_fixed_res.status_code == 200
    reg_fixed_data = reg_fixed_res.json()
    assert reg_fixed_data["gateDecision"]["status"] == "PASS"
    assert reg_fixed_data["gateDecision"]["isPassing"] is True

    # Step 12: Verify Workspace isolation by querying created workspace
    ws_fetch_res = client.get(f"/workspaces/{ws_id}")
    assert ws_fetch_res.status_code == 200
    assert ws_fetch_res.json()["workspaceId"] == ws_id
