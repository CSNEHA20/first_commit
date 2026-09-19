"""
Unit tests for PolicyLab Regression Engine & Pre-Deployment Gate
"""

import json
from pathlib import Path
import pytest

from backend.domain.models.authz import AuthorizationDecision
from backend.domain.models.contract import (
    ContractSeverity,
    ContractType,
    SecurityContract,
)
from backend.domain.models.regression import (
    DeploymentGateStatus,
    RegressionRunRequest,
)
from backend.domain.models.scenario import ScenarioSuite
from backend.domain.cedar.regression import RegressionEngine

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def valid_policy():
    with open(FIXTURES_DIR / "valid_policy.cedar", "r") as f:
        return f.read()


@pytest.fixture
def candidate_v13_policy():
    with open(FIXTURES_DIR / "candidate_policy_v13.cedar", "r") as f:
        return f.read()


@pytest.fixture
def entities():
    with open(FIXTURES_DIR / "entities.json", "r") as f:
        return json.load(f)


@pytest.fixture
def scenarios_suite():
    with open(FIXTURES_DIR / "scenarios.json", "r") as f:
        data = json.load(f)
        return ScenarioSuite(**data)


@pytest.fixture
def acmepay_contracts():
    return [
        SecurityContract(
            id="SC-01",
            title="Admin Full Access",
            severity=ContractSeverity.HIGH,
            isBlocking=True,
            scenarioIds=["sc_01", "sc_02"],
            expectedDecision=AuthorizationDecision.ALLOW,
        ),
        SecurityContract(
            id="SC-02",
            title="Editor View and Edit Invoices",
            severity=ContractSeverity.HIGH,
            isBlocking=True,
            scenarioIds=["sc_03", "sc_04"],
            expectedDecision=AuthorizationDecision.ALLOW,
        ),
        SecurityContract(
            id="SC-03",
            title="Editor Invoice Deletion Prohibited",
            severity=ContractSeverity.CRITICAL,
            isBlocking=True,
            scenarioIds=["sc_05"],
            expectedDecision=AuthorizationDecision.DENY,
        ),
        SecurityContract(
            id="SC-04",
            title="Contractor Payroll Isolation",
            severity=ContractSeverity.CRITICAL,
            isBlocking=True,
            scenarioIds=["sc_06"],
            expectedDecision=AuthorizationDecision.DENY,
        ),
    ]


def test_regression_gate_blocked_by_candidate_v13_violation(
    valid_policy, candidate_v13_policy, entities, scenarios_suite, acmepay_contracts
):
    engine = RegressionEngine()
    req = RegressionRunRequest(
        baselinePolicyText=valid_policy,
        candidatePolicyText=candidate_v13_policy,
        entities=entities,
        suite=scenarios_suite,
        contracts=acmepay_contracts,
    )
    report = engine.run_regression(req)

    assert report.gateDecision.status == DeploymentGateStatus.BLOCKED
    assert report.gateDecision.isPassing is False
    assert report.gateDecision.blockingViolationsCount == 1
    assert report.gateDecision.requiresHumanApproval is True
    assert any("SC-03: Editor Invoice Deletion Prohibited" in r for r in report.gateDecision.reasons)
    assert len(report.counterexamples) == 2


def test_regression_gate_passes_when_candidate_conforms(
    valid_policy, entities, scenarios_suite, acmepay_contracts
):
    engine = RegressionEngine()
    req = RegressionRunRequest(
        baselinePolicyText=valid_policy,
        candidatePolicyText=valid_policy,  # Same policy conforms to all contracts
        entities=entities,
        suite=scenarios_suite,
        contracts=acmepay_contracts,
    )
    report = engine.run_regression(req)

    assert report.gateDecision.status == DeploymentGateStatus.PASS
    assert report.gateDecision.isPassing is True
    assert report.gateDecision.blockingViolationsCount == 0
    assert report.gateDecision.requiresHumanApproval is True
    assert len(report.counterexamples) == 0
    assert any("satisfied" in r for r in report.gateDecision.reasons)


def test_regression_gate_invalid_policy_fails_validation(
    valid_policy, entities, scenarios_suite, acmepay_contracts
):
    engine = RegressionEngine()
    req = RegressionRunRequest(
        baselinePolicyText=valid_policy,
        candidatePolicyText="invalid cedar syntax @@@ !!!",
        entities=entities,
        suite=scenarios_suite,
        contracts=acmepay_contracts,
    )
    with pytest.raises(ValueError, match="Candidate policy syntax error"):
        engine.run_regression(req)
