"""
Unit Tests for PolicyLab Policy Diff Engine (Phase 3)
Tests deterministic policy comparison, behavioral transition classification
(UNCHANGED_ALLOW, UNCHANGED_DENY, NEWLY_FORBIDDEN, NEWLY_AUTHORIZED),
bounded impact summary metrics, delta metrics (ΔP, ΔA, ΔR), and error handling.
"""

import json
from pathlib import Path
import pytest

from backend.domain.cedar.diff import CedarPolicyDiffService
from backend.domain.cedar.runner import ScenarioRunner
from backend.domain.cedar.engine import LocalCedarAdapter
from backend.domain.cedar.validation import CedarValidationService
from backend.domain.models.authz import AuthorizationDecision
from backend.domain.models.diff import (
    BehavioralTransition,
    PolicyDiffRequest,
    ScenarioComparisonStatus,
)
from backend.domain.models.scenario import Scenario, ScenarioSuite

FIXTURES_DIR = Path(__file__).parents[2] / "fixtures"


@pytest.fixture
def baseline_policy_text() -> str:
    return (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def candidate_v13_policy_text() -> str:
    return (FIXTURES_DIR / "candidate_policy_v13.cedar").read_text(encoding="utf-8")


@pytest.fixture
def candidate_restricted_policy_text() -> str:
    return (FIXTURES_DIR / "candidate_policy_restricted.cedar").read_text(encoding="utf-8")


@pytest.fixture
def invalid_policy_text() -> str:
    return (FIXTURES_DIR / "invalid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def valid_entities() -> list:
    return json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))


@pytest.fixture
def acmepay_suite() -> ScenarioSuite:
    suite_data = json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))
    return ScenarioSuite(**suite_data)


@pytest.fixture
def diff_service() -> CedarPolicyDiffService:
    engine = LocalCedarAdapter()
    runner = ScenarioRunner(engine=engine)
    validator = CedarValidationService(engine=engine)
    return CedarPolicyDiffService(scenario_runner=runner, validation_service=validator)


def test_diff_baseline_v12_vs_candidate_v13(
    diff_service: CedarPolicyDiffService,
    baseline_policy_text: str,
    candidate_v13_policy_text: str,
    valid_entities: list,
    acmepay_suite: ScenarioSuite,
):
    """
    Verify comparison of AcmePay Baseline v12 vs Proposed Candidate v13.
    Accurately detects NEWLY_AUTHORIZED regressions for Editor delete and Contractor delete ticket.
    """
    req = PolicyDiffRequest(
        baselinePolicyText=baseline_policy_text,
        candidatePolicyText=candidate_v13_policy_text,
        entities=valid_entities,
        suite=acmepay_suite,
        baselineLabel="AcmePay v12 (Prod)",
        candidateLabel="AcmePay v13 (Proposed)",
    )

    report = diff_service.compare(req)

    assert report.baselineLabel == "AcmePay v12 (Prod)"
    assert report.candidateLabel == "AcmePay v13 (Proposed)"
    assert report.impactSummary.totalScenariosDeclared == 11
    assert report.impactSummary.totalScenariosCompared == 11
    assert report.impactSummary.uncomparableScenariosCount == 0
    assert report.impactSummary.comparisonCoveragePct == 100.0

    # Under v13:
    # sc_05: Editor delete invoice was DENY in v12, becomes ALLOW in v13 -> NEWLY_AUTHORIZED
    # sc_09: Contractor delete ticket was DENY in v12, becomes ALLOW in v13 -> NEWLY_AUTHORIZED
    assert report.impactSummary.newlyAuthorizedCount == 2
    assert report.impactSummary.newlyForbiddenCount == 0
    assert report.impactSummary.unchangedAllowCount == 6
    assert report.impactSummary.unchangedDenyCount == 3

    # Check Delta metrics
    assert report.impactSummary.deltaPrincipals == 2  # editor_bob, contractor_alice
    assert report.impactSummary.deltaActions == 1     # Action::"delete"
    assert report.impactSummary.deltaResources == 2   # Invoice::"inv_9082", SupportTicket::"ticket_102"
    assert 'User::"editor_bob"' in report.impactSummary.affectedPrincipals
    assert 'User::"contractor_alice"' in report.impactSummary.affectedPrincipals

    # Check specific scenario diff results
    diff_map = {d.scenarioId: d for d in report.scenarioDiffs}

    # sc_01: Admin delete invoice -> UNCHANGED_ALLOW
    assert diff_map["sc_01"].transition == BehavioralTransition.UNCHANGED_ALLOW
    assert diff_map["sc_01"].baselineDecision == AuthorizationDecision.ALLOW
    assert diff_map["sc_01"].candidateDecision == AuthorizationDecision.ALLOW

    # sc_05: Editor delete invoice -> NEWLY_AUTHORIZED
    assert diff_map["sc_05"].transition == BehavioralTransition.NEWLY_AUTHORIZED
    assert diff_map["sc_05"].baselineDecision == AuthorizationDecision.DENY
    assert diff_map["sc_05"].candidateDecision == AuthorizationDecision.ALLOW

    # sc_06: Contractor delete payroll -> UNCHANGED_DENY (explicit forbid matches in both)
    assert diff_map["sc_06"].transition == BehavioralTransition.UNCHANGED_DENY
    assert diff_map["sc_06"].baselineDecision == AuthorizationDecision.DENY
    assert diff_map["sc_06"].candidateDecision == AuthorizationDecision.DENY

    # Check newly authorized partition
    newly_auth_ids = [d.scenarioId for d in report.newlyAuthorizedScenarios]
    assert sorted(newly_auth_ids) == ["sc_05", "sc_09"]


def test_diff_baseline_v12_vs_restricted_newly_forbidden(
    diff_service: CedarPolicyDiffService,
    baseline_policy_text: str,
    candidate_restricted_policy_text: str,
    valid_entities: list,
    acmepay_suite: ScenarioSuite,
):
    """
    Verify comparison of Baseline v12 vs Restricted Policy.
    Accurately detects NEWLY_FORBIDDEN transitions.
    """
    req = PolicyDiffRequest(
        baselinePolicyText=baseline_policy_text,
        candidatePolicyText=candidate_restricted_policy_text,
        entities=valid_entities,
        suite=acmepay_suite,
    )

    report = diff_service.compare(req)

    # In restricted policy:
    # sc_04: Editor edit invoice -> was ALLOW, now DENY (NEWLY_FORBIDDEN)
    # sc_08: Contractor view support ticket -> was ALLOW, now DENY (NEWLY_FORBIDDEN)
    # sc_10: Finance export payroll -> was ALLOW, now DENY (NEWLY_FORBIDDEN)
    assert report.impactSummary.newlyForbiddenCount == 3
    assert report.impactSummary.newlyAuthorizedCount == 0

    diff_map = {d.scenarioId: d for d in report.scenarioDiffs}
    assert diff_map["sc_04"].transition == BehavioralTransition.NEWLY_FORBIDDEN
    assert diff_map["sc_08"].transition == BehavioralTransition.NEWLY_FORBIDDEN
    assert diff_map["sc_10"].transition == BehavioralTransition.NEWLY_FORBIDDEN

    newly_forbid_ids = [d.scenarioId for d in report.newlyForbiddenScenarios]
    assert sorted(newly_forbid_ids) == ["sc_04", "sc_08", "sc_10"]


def test_diff_invalid_baseline_policy_raises_error(
    diff_service: CedarPolicyDiffService,
    invalid_policy_text: str,
    baseline_policy_text: str,
    acmepay_suite: ScenarioSuite,
):
    """Verify invalid syntax in baseline policy raises ValueError."""
    req = PolicyDiffRequest(
        baselinePolicyText=invalid_policy_text,
        candidatePolicyText=baseline_policy_text,
        suite=acmepay_suite,
    )

    with pytest.raises(ValueError) as exc_info:
        diff_service.compare(req)

    assert "Baseline policy syntax error" in str(exc_info.value)


def test_diff_invalid_candidate_policy_raises_error(
    diff_service: CedarPolicyDiffService,
    baseline_policy_text: str,
    invalid_policy_text: str,
    acmepay_suite: ScenarioSuite,
):
    """Verify invalid syntax in candidate policy raises ValueError."""
    req = PolicyDiffRequest(
        baselinePolicyText=baseline_policy_text,
        candidatePolicyText=invalid_policy_text,
        suite=acmepay_suite,
    )

    with pytest.raises(ValueError) as exc_info:
        diff_service.compare(req)

    assert "Candidate policy syntax error" in str(exc_info.value)


def test_diff_empty_scenario_suite_returns_empty_report(
    diff_service: CedarPolicyDiffService,
    baseline_policy_text: str,
    candidate_v13_policy_text: str,
):
    """Verify empty scenario suite returns an empty report cleanly."""
    empty_suite = ScenarioSuite(
        id="suite_empty",
        name="Empty Suite",
        scenarios=[],
    )

    req = PolicyDiffRequest(
        baselinePolicyText=baseline_policy_text,
        candidatePolicyText=candidate_v13_policy_text,
        suite=empty_suite,
    )

    report = diff_service.compare(req)
    assert report.impactSummary.totalScenariosDeclared == 0
    assert report.impactSummary.totalScenariosCompared == 0
    assert report.scenarioDiffs == []


def test_diff_handles_execution_error_as_uncomparable(
    diff_service: CedarPolicyDiffService,
    baseline_policy_text: str,
    candidate_v13_policy_text: str,
    valid_entities: list,
):
    """
    Verify that an execution error in a scenario marks it UNCOMPARABLE and
    excludes it from behavioral transition counts.
    """
    good_scenario = Scenario(
        id="sc_good",
        title="Valid scenario",
        principal='User::"admin_root"',
        action='Action::"delete"',
        resource='Invoice::"inv_001"',
    )
    bad_scenario = Scenario(
        id="sc_bad",
        title="Invalid entity UID scenario",
        principal='Invalid Entity UID Format',
        action='Action::"view"',
        resource='Invoice::"inv_001"',
    )

    suite = ScenarioSuite(
        id="suite_uncomparable_test",
        name="Uncomparable Test Suite",
        scenarios=[good_scenario, bad_scenario],
    )

    req = PolicyDiffRequest(
        baselinePolicyText=baseline_policy_text,
        candidatePolicyText=candidate_v13_policy_text,
        entities=valid_entities,
        suite=suite,
    )

    report = diff_service.compare(req)

    assert report.impactSummary.totalScenariosDeclared == 2
    assert report.impactSummary.totalScenariosCompared == 1
    assert report.impactSummary.uncomparableScenariosCount == 1

    diff_map = {d.scenarioId: d for d in report.scenarioDiffs}
    assert diff_map["sc_good"].status == ScenarioComparisonStatus.COMPARABLE
    assert diff_map["sc_good"].transition == BehavioralTransition.UNCHANGED_ALLOW

    assert diff_map["sc_bad"].status == ScenarioComparisonStatus.UNCOMPARABLE
    assert diff_map["sc_bad"].transition is None
    assert diff_map["sc_bad"].error is not None
