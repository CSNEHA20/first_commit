"""
Integration tests for PolicyLab Phase 7 APIs:
- Input validation boundary (/validate-inputs)
- Natural language policy generator (/policies/generate)
- Strands policy audit agent (/audits/agent-run)
- Audit report export (/audits/export)
- Effective access matrix (/matrix/evaluate)
- What-If simulator (/simulator/what-if)
- Version timeline (/policies/{set_id}/timeline)
- Entity snapshot management (/entity-snapshots)
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def valid_policy():
    with open(FIXTURES_DIR / "valid_policy.cedar", "r") as f:
        return f.read()


@pytest.fixture
def candidate_v13():
    with open(FIXTURES_DIR / "candidate_policy_v13.cedar", "r") as f:
        return f.read()


import json

@pytest.fixture
def entities():
    with open(FIXTURES_DIR / "entities.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_suite():
    return {
        "id": "suite_phase7",
        "name": "Phase 7 Verification Suite",
        "scenarios": [
            {
                "id": "sc_editor_view",
                "title": "Editor views invoice",
                "principal": 'User::"editor_bob"',
                "action": 'Action::"view"',
                "resource": 'Invoice::"inv_001"',
                "context": {},
                "expectedDecision": "ALLOW",
            },
            {
                "id": "sc_editor_delete",
                "title": "Editor deletes invoice",
                "principal": 'User::"editor_bob"',
                "action": 'Action::"delete"',
                "resource": 'Invoice::"inv_001"',
                "context": {},
                "expectedDecision": "DENY",
            },
            {
                "id": "sc_contractor_delete",
                "title": "Contractor deletes payroll report",
                "principal": 'User::"contractor_alice"',
                "action": 'Action::"delete"',
                "resource": 'PayrollReport::"payroll_q3"',
                "context": {},
                "expectedDecision": "DENY",
            },
        ],
    }


def test_api_validate_inputs_valid(client, valid_policy):
    payload = {
        "policyText": valid_policy,
        "principal": 'User::"editor_bob"',
        "action": 'Action::"view"',
        "resource": 'Invoice::"inv_001"',
        "context": {"ip": "10.0.0.1"},
        "entities": [],
    }
    res = client.post("/validate-inputs", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["isValid"] is True
    assert data["stage"] == "REQUEST_CONTEXT"


def test_api_validate_inputs_invalid_action(client, valid_policy):
    payload = {
        "policyText": valid_policy,
        "principal": 'User::"editor_bob"',
        "action": 'User::"not_an_action"',
        "resource": 'Invoice::"inv_001"',
        "context": {},
        "entities": [],
    }
    res = client.post("/validate-inputs", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["isValid"] is False
    assert any("INVALID_ACTION_TYPE" in str(e) for e in data["errors"])


def test_api_generate_policy_untrusted_draft(client):
    payload = {
        "prompt": "Editors can view invoices",
        "intent": "PERMIT_EDITOR_VIEW",
    }
    res = client.post("/policies/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["isTrusted"] is False
    assert data["requiresValidation"] is True
    assert "permit" in data["generatedCedar"]
    assert data["isValidSyntax"] is True


def test_api_access_matrix(client, valid_policy):
    payload = {
        "policyText": valid_policy,
        "principals": ['User::"admin_root"', 'User::"contractor_alice"'],
        "actions": ['Action::"view"', 'Action::"delete"'],
        "resources": ['Invoice::"inv_001"'],
    }
    res = client.post("/matrix/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["totalEvaluations"] == 4
    assert len(data["rows"]) == 2


def test_api_what_if_simulator(client, valid_policy, candidate_v13, sample_suite, entities):
    payload = {
        "baselinePolicyText": valid_policy,
        "proposedPolicyText": candidate_v13,
        "suite": sample_suite,
        "entities": entities,
    }
    res = client.post("/simulator/what-if", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "impact" in data
    assert data["impact"]["newlyPermittedCount"] >= 1


def test_api_version_timeline(client, valid_policy):
    # Get timeline
    res = client.get("/policies/ps-acmepay-prod/timeline")
    assert res.status_code == 200
    timeline = res.json()
    assert len(timeline) >= 2

    # Record new version
    new_v = {
        "versionTag": "v15_test",
        "policyText": valid_policy,
        "author": "Sneha",
        "changeSummary": "Hardened contractor policies",
        "gateStatus": "PASS",
    }
    res2 = client.post("/policies/ps-acmepay-prod/versions", json=new_v)
    assert res2.status_code == 200
    assert res2.json()["versionTag"] == "v15_test"


def test_api_entity_snapshots(client):
    # Create snapshot
    res = client.post("/entity-snapshots", json={"snapshotId": "snap_api_test_01"})
    assert res.status_code == 200
    snap = res.json()
    assert snap["snapshotId"] == "snap_api_test_01"
    assert snap["contentHash"] is not None

    # Get snapshot
    res2 = client.get("/entity-snapshots/snap_api_test_01")
    assert res2.status_code == 200
    assert res2.json()["contentHash"] == snap["contentHash"]


def test_api_strands_agent_audit_and_export(client, valid_policy, candidate_v13, sample_suite, entities):
    # Run Agent Audit
    audit_payload = {
        "baselinePolicyText": valid_policy,
        "candidatePolicyText": candidate_v13,
        "suite": sample_suite,
        "entities": entities,
        "contracts": [
            {
                "id": "SEC-001",
                "title": "Editor Delete Invariant",
                "description": "Editors must never delete invoices",
                "severity": "CRITICAL",
                "isBlocking": True,
                "scenarioIds": ["sc_editor_delete"],
                "expectedDecision": "DENY",
            }
        ],
        "runAiExplanation": True,
    }
    res = client.post("/audits/agent-run", json=audit_payload)
    assert res.status_code == 200
    report = res.json()
    assert report["agentIdentity"] == "PolicyAuditAgent"
    assert report["gateDecision"] == "BLOCKED"
    assert len(report["counterexamples"]) >= 1
    assert len(report["toolInvocations"]) >= 3

    # Export report to markdown
    export_payload = {
        "report": report,
        "format": "markdown",
    }
    res_export = client.post("/audits/export", json=export_payload)
    assert res_export.status_code == 200
    export_data = res_export.json()
    assert export_data["format"] == "markdown"
    assert "# PolicyLab Formal Authorization Audit Report" in export_data["content"]
    assert "Counterexample Evidence Ledger" in export_data["content"]
