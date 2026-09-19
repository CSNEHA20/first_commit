"""
Unit tests for PolicyLab Security Contract Service
"""

import json
from pathlib import Path
import pytest

from backend.domain.models.authz import AuthorizationDecision
from backend.domain.models.contract import (
    ContractEvaluationRequest,
    ContractSeverity,
    ContractStatus,
    ContractType,
    SecurityContract,
)
from backend.domain.models.diff import (
    PolicyDiffRequest,
    ScenarioComparisonStatus,
    ScenarioDiffResult,
)
from backend.domain.models.scenario import ScenarioSuite
from backend.domain.cedar.contract import SecurityContractService
from backend.domain.cedar.counterexample import CounterexampleEngine
from backend.domain.cedar.diff import CedarPolicyDiffService

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
def sample_contracts():
    return [
        SecurityContract(
            id="SC-01",
            title="Admin Full Access",
            description="Admins must be permitted for all administrative operations.",
            severity=ContractSeverity.HIGH,
            isBlocking=True,
            contractType=ContractType.INVARIANT_PERMITTED,
            scenarioIds=["sc_01", "sc_02"],
            expectedDecision=AuthorizationDecision.ALLOW,
        ),
        SecurityContract(
            id="SC-03",
            title="Editor Invoice Deletion Prohibited",
            description="Editors must never be permitted to delete invoice records.",
            severity=ContractSeverity.CRITICAL,
            isBlocking=True,
            contractType=ContractType.INVARIANT_DENIED,
            scenarioIds=["sc_05"],
            expectedDecision=AuthorizationDecision.DENY,
        ),
        SecurityContract(
            id="SC-04",
            title="Contractor Payroll Isolation",
            description="External contractors must never delete payroll records.",
            severity=ContractSeverity.CRITICAL,
            isBlocking=True,
            contractType=ContractType.INVARIANT_DENIED,
            scenarioIds=["sc_06"],
            expectedDecision=AuthorizationDecision.DENY,
        ),
    ]


def test_contract_evaluation_satisfied_under_baseline(
    valid_policy, entities, scenarios_suite, sample_contracts
):
    service = SecurityContractService()
    req = ContractEvaluationRequest(
        policyText=valid_policy,
        entities=entities,
        suite=scenarios_suite,
        contracts=sample_contracts,
    )
    report = service.evaluate_standalone(req)
    assert report.totalContracts == 3
    assert report.passedContracts == 3
    assert report.failedContracts == 0
    assert report.allBlockingPassed is True


def test_contract_evaluation_violated_under_candidate_v13(
    candidate_v13_policy, entities, scenarios_suite, sample_contracts
):
    service = SecurityContractService()
    req = ContractEvaluationRequest(
        policyText=candidate_v13_policy,
        entities=entities,
        suite=scenarios_suite,
        contracts=sample_contracts,
    )
    report = service.evaluate_standalone(req)
    assert report.totalContracts == 3
    assert report.passedContracts == 2
    assert report.failedContracts == 1
    assert report.allBlockingPassed is False

    sc03_res = next(r for r in report.results if r.contractId == "SC-03")
    assert sc03_res.status == ContractStatus.FAIL
    assert sc03_res.violatingScenarioIds == ["sc_05"]
    assert "evaluated to ALLOW (expected DENY)" in (sc03_res.failureReason or "")


def test_contract_evaluation_against_diff_with_counterexamples(
    valid_policy, candidate_v13_policy, entities, scenarios_suite, sample_contracts
):
    diff_service = CedarPolicyDiffService()
    cx_engine = CounterexampleEngine()
    contract_service = SecurityContractService()

    diff_report = diff_service.compare(
        PolicyDiffRequest(
            baselinePolicyText=valid_policy,
            candidatePolicyText=candidate_v13_policy,
            entities=entities,
            suite=scenarios_suite,
        )
    )

    counterexamples = cx_engine.extract_counterexamples(
        scenario_diffs=diff_report.scenarioDiffs,
        contracts=sample_contracts,
        baseline_label="v12",
        candidate_label="v13",
        entities=entities,
    )

    contract_results = contract_service.evaluate_against_diff(
        contracts=sample_contracts,
        scenario_diffs=diff_report.scenarioDiffs,
        counterexamples=counterexamples,
    )

    sc03_res = next(r for r in contract_results if r.contractId == "SC-03")
    assert sc03_res.status == ContractStatus.FAIL
    assert "cx_sc_05" in sc03_res.counterexampleIds


def test_contract_with_no_matching_scenarios_reports_bounded_pass():
    service = SecurityContractService()
    contract = SecurityContract(
        id="SC-99",
        title="Non-existent scenario contract",
        severity=ContractSeverity.LOW,
        scenarioIds=["sc_9999"],
        expectedDecision=AuthorizationDecision.DENY,
    )
    diffs = [
        ScenarioDiffResult(
            scenarioId="sc_01",
            principal='User::"admin"',
            action='Action::"delete"',
            resource='Invoice::"01"',
            status=ScenarioComparisonStatus.COMPARABLE,
            candidateDecision=AuthorizationDecision.ALLOW,
        )
    ]
    results = service.evaluate_against_diff(contracts=[contract], scenario_diffs=diffs)
    assert len(results) == 1
    assert results[0].status == ContractStatus.PASS
    assert results[0].evaluatedScenariosCount == 0


def test_contract_with_uncomparable_scenarios_reports_uncomparable():
    service = SecurityContractService()
    contract = SecurityContract(
        id="SC-05",
        title="Uncomparable error scenario",
        severity=ContractSeverity.HIGH,
        scenarioIds=["sc_err"],
        expectedDecision=AuthorizationDecision.DENY,
    )
    diffs = [
        ScenarioDiffResult(
            scenarioId="sc_err",
            principal='User::"test"',
            action='Action::"view"',
            resource='Resource::"01"',
            status=ScenarioComparisonStatus.UNCOMPARABLE,
            error="Cedar syntax error in scenario",
        )
    ]
    results = service.evaluate_against_diff(contracts=[contract], scenario_diffs=diffs)
    assert len(results) == 1
    assert results[0].status == ContractStatus.UNCOMPARABLE
    assert "encountered evaluation errors" in (results[0].failureReason or "")
