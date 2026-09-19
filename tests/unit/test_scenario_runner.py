"""
Unit Tests for PolicyLab Scenario Runner Service (Phase 2)
Tests deterministic batch execution, result ordering, aggregate metrics,
error handling, and duplicate scenario rejection.
"""

import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from backend.domain.cedar.runner import ScenarioRunner
from backend.domain.cedar.engine import LocalCedarAdapter
from backend.domain.models.authz import AuthorizationDecision
from backend.domain.models.scenario import (
    BatchSimulationRequest,
    Scenario,
    ScenarioExecutionStatus,
    ScenarioSuite,
    SimulationRunStatus,
)

FIXTURES_DIR = Path(__file__).parents[2] / "fixtures"


@pytest.fixture
def valid_policy_text() -> str:
    return (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def valid_entities() -> list:
    return json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))


@pytest.fixture
def acmepay_suite() -> ScenarioSuite:
    suite_data = json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))
    return ScenarioSuite(**suite_data)


@pytest.fixture
def runner() -> ScenarioRunner:
    return ScenarioRunner(engine=LocalCedarAdapter())


def test_scenario_suite_rejects_duplicate_scenario_ids():
    """Verify ScenarioSuite model validation catches duplicate scenario IDs."""
    sc1 = Scenario(
        id="sc_duplicate",
        title="First scenario",
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"1"',
    )
    sc2 = Scenario(
        id="sc_duplicate",
        title="Second scenario with same ID",
        principal='User::"bob"',
        action='Action::"delete"',
        resource='Invoice::"2"',
    )

    with pytest.raises(ValidationError) as exc_info:
        ScenarioSuite(
            id="suite_test_duplicates",
            name="Duplicate Test Suite",
            scenarios=[sc1, sc2],
        )

    assert "Duplicate scenario identifier" in str(exc_info.value)
    assert "sc_duplicate" in str(exc_info.value)


def test_scenario_runner_executes_suite_deterministically(
    runner: ScenarioRunner,
    valid_policy_text: str,
    valid_entities: list,
    acmepay_suite: ScenarioSuite,
):
    """Verify batch runner executes all 11 scenarios and preserves result ordering and metrics."""
    req = BatchSimulationRequest(
        policyText=valid_policy_text,
        entities=valid_entities,
        suite=acmepay_suite,
    )

    run_result = runner.run(req)

    assert run_result.status == SimulationRunStatus.COMPLETED
    assert run_result.totalScenarios == 11
    assert run_result.successCount == 11
    assert run_result.errorCount == 0
    assert len(run_result.results) == 11

    # Check that scenario results preserve exact ordering
    expected_ids = [sc.id for sc in acmepay_suite.scenarios]
    actual_ids = [res.scenarioId for res in run_result.results]
    assert actual_ids == expected_ids

    # Check that expectations matched 100% under valid policy v12
    assert run_result.passedExpectationsCount == 11
    assert run_result.failedExpectationsCount == 0

    # Verify specific outcomes
    # sc_01: Admin delete -> ALLOW
    assert run_result.results[0].scenarioId == "sc_01"
    assert run_result.results[0].decision == AuthorizationDecision.ALLOW
    assert run_result.results[0].isExpected is True

    # sc_05: Editor delete -> DENY
    assert run_result.results[4].scenarioId == "sc_05"
    assert run_result.results[4].decision == AuthorizationDecision.DENY
    assert run_result.results[4].isExpected is True

    # sc_06: Contractor delete payroll -> DENY via explicit forbid
    assert run_result.results[5].scenarioId == "sc_06"
    assert run_result.results[5].decision == AuthorizationDecision.DENY
    assert "policy4" in run_result.results[5].determiningPolicies
    assert run_result.results[5].isExpected is True


def test_scenario_runner_empty_suite_returns_completed_run(
    runner: ScenarioRunner,
    valid_policy_text: str,
    valid_entities: list,
):
    """Verify running an empty suite returns an empty completed run cleanly."""
    empty_suite = ScenarioSuite(
        id="suite_empty",
        name="Empty Test Suite",
        scenarios=[],
    )

    req = BatchSimulationRequest(
        policyText=valid_policy_text,
        entities=valid_entities,
        suite=empty_suite,
    )

    run_result = runner.run(req)
    assert run_result.status == SimulationRunStatus.COMPLETED
    assert run_result.totalScenarios == 0
    assert run_result.successCount == 0
    assert run_result.errorCount == 0
    assert run_result.results == []


def test_scenario_runner_empty_policy_raises_validation_error(
    runner: ScenarioRunner,
    acmepay_suite: ScenarioSuite,
):
    """Verify empty policy string is rejected immediately."""
    req = BatchSimulationRequest(
        policyText="   ",
        suite=acmepay_suite,
    )

    with pytest.raises(ValueError) as exc_info:
        runner.run(req)

    assert "Policy text cannot be empty" in str(exc_info.value)


def test_scenario_runner_handles_scenario_execution_error_without_faking_deny(
    runner: ScenarioRunner,
    valid_policy_text: str,
    valid_entities: list,
):
    """
    Verify that an unparseable/malformed entity in a scenario records an EXECUTION_ERROR
    and is NOT disguised as an authorization decision (ALLOW or DENY).
    """
    valid_scenario = Scenario(
        id="sc_good",
        title="Valid scenario",
        principal='User::"admin_root"',
        action='Action::"view"',
        resource='Invoice::"inv_001"',
        expectedDecision=AuthorizationDecision.ALLOW,
    )

    # Malformed scenario UID that causes an execution failure
    bad_scenario = Scenario(
        id="sc_bad",
        title="Bad scenario with invalid entity UID syntax",
        principal='Invalid Entity UID Without Colons',
        action='Action::"view"',
        resource='Invoice::"inv_001"',
        expectedDecision=AuthorizationDecision.ALLOW,
    )

    suite = ScenarioSuite(
        id="suite_error_test",
        name="Error Handling Suite",
        scenarios=[valid_scenario, bad_scenario],
    )

    req = BatchSimulationRequest(
        policyText=valid_policy_text,
        entities=valid_entities,
        suite=suite,
    )

    run_result = runner.run(req)

    assert run_result.totalScenarios == 2
    # Verify good scenario succeeded
    assert run_result.results[0].scenarioId == "sc_good"
    assert run_result.results[0].status == ScenarioExecutionStatus.SUCCESS
    assert run_result.results[0].decision == AuthorizationDecision.ALLOW

    # Verify bad scenario resulted in EXECUTION_ERROR and decision is None (not DENY or ALLOW)
    assert run_result.results[1].scenarioId == "sc_bad"
    assert run_result.results[1].status == ScenarioExecutionStatus.EXECUTION_ERROR
    assert run_result.results[1].decision is None
    assert run_result.results[1].error is not None
    assert run_result.errorCount == 1
    assert run_result.status == SimulationRunStatus.PARTIAL_FAILURE
