"""
Unit tests for PolicyLab Counterexample Engine & Deterministic Replay
"""

import json
from pathlib import Path
import pytest

from backend.domain.models.authz import AuthorizationDecision
from backend.domain.models.counterexample import (
    Counterexample,
    CounterexampleReplayRequest,
)
from backend.domain.models.diff import (
    BehavioralTransition,
    PolicyDiffRequest,
    ScenarioComparisonStatus,
    ScenarioDiffResult,
)
from backend.domain.models.scenario import ScenarioSuite
from backend.domain.cedar.counterexample import CounterexampleEngine
from backend.domain.cedar.diff import CedarPolicyDiffService
from backend.domain.cedar.evaluation import CedarEvaluationService

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
def candidate_restricted_policy():
    with open(FIXTURES_DIR / "candidate_policy_restricted.cedar", "r") as f:
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


def test_extract_counterexamples_newly_authorized(
    valid_policy, candidate_v13_policy, entities, scenarios_suite
):
    diff_service = CedarPolicyDiffService()
    engine = CounterexampleEngine()

    diff_report = diff_service.compare(
        PolicyDiffRequest(
            baselinePolicyText=valid_policy,
            candidatePolicyText=candidate_v13_policy,
            entities=entities,
            suite=scenarios_suite,
        )
    )

    counterexamples = engine.extract_counterexamples(
        scenario_diffs=diff_report.scenarioDiffs,
        baseline_label="v12",
        candidate_label="v13",
        entities=entities,
    )

    # v13 introduces 2 newly authorized scenarios:
    # sc_05 (Editor delete invoice) and sc_09 (Contractor delete ticket)
    assert len(counterexamples) == 2

    cx_map = {cx.scenarioId: cx for cx in counterexamples}
    assert "sc_05" in cx_map
    assert "sc_09" in cx_map

    cx_05 = cx_map["sc_05"]
    assert cx_05.principal == 'User::"editor_bob"'
    assert cx_05.action == 'Action::"delete"'
    assert cx_05.resource == 'Invoice::"inv_9082"'
    assert cx_05.baselineDecision == AuthorizationDecision.DENY
    assert cx_05.candidateDecision == AuthorizationDecision.ALLOW
    assert cx_05.transition == BehavioralTransition.NEWLY_AUTHORIZED
    assert "Behavioral Expansion" in cx_05.explanation


def test_extract_counterexamples_newly_forbidden(
    valid_policy, candidate_restricted_policy, entities, scenarios_suite
):
    diff_service = CedarPolicyDiffService()
    engine = CounterexampleEngine()

    diff_report = diff_service.compare(
        PolicyDiffRequest(
            baselinePolicyText=valid_policy,
            candidatePolicyText=candidate_restricted_policy,
            entities=entities,
            suite=scenarios_suite,
        )
    )

    counterexamples = engine.extract_counterexamples(
        scenario_diffs=diff_report.scenarioDiffs,
        baseline_label="v12",
        candidate_label="Restricted",
        entities=entities,
    )

    # restricted revokes edit invoice (sc_04), support ticket view (sc_08), and finance export (sc_10)
    assert len(counterexamples) == 3
    for cx in counterexamples:
        assert cx.transition == BehavioralTransition.NEWLY_FORBIDDEN
        assert cx.baselineDecision == AuthorizationDecision.ALLOW
        assert cx.candidateDecision == AuthorizationDecision.DENY
        assert "Behavioral Restriction" in cx.explanation


def test_no_counterexamples_for_unchanged_results():
    engine = CounterexampleEngine()
    diffs = [
        ScenarioDiffResult(
            scenarioId="sc_01",
            scenarioTitle="Admin Delete",
            principal='User::"admin"',
            action='Action::"delete"',
            resource='Invoice::"01"',
            status=ScenarioComparisonStatus.COMPARABLE,
            transition=BehavioralTransition.UNCHANGED_ALLOW,
            baselineDecision=AuthorizationDecision.ALLOW,
            candidateDecision=AuthorizationDecision.ALLOW,
        ),
        ScenarioDiffResult(
            scenarioId="sc_02",
            scenarioTitle="Viewer Delete",
            principal='User::"viewer"',
            action='Action::"delete"',
            resource='Invoice::"01"',
            status=ScenarioComparisonStatus.COMPARABLE,
            transition=BehavioralTransition.UNCHANGED_DENY,
            baselineDecision=AuthorizationDecision.DENY,
            candidateDecision=AuthorizationDecision.DENY,
        ),
    ]
    cx_list = engine.extract_counterexamples(scenario_diffs=diffs)
    assert len(cx_list) == 0


def test_counterexample_replay_successful_reproduction(
    valid_policy, candidate_v13_policy, entities, scenarios_suite
):
    diff_service = CedarPolicyDiffService()
    engine = CounterexampleEngine()

    diff_report = diff_service.compare(
        PolicyDiffRequest(
            baselinePolicyText=valid_policy,
            candidatePolicyText=candidate_v13_policy,
            entities=entities,
            suite=scenarios_suite,
        )
    )

    counterexamples = engine.extract_counterexamples(
        scenario_diffs=diff_report.scenarioDiffs,
        baseline_label="v12",
        candidate_label="v13",
        entities=entities,
    )
    cx_05 = next(cx for cx in counterexamples if cx.scenarioId == "sc_05")

    replay_req = CounterexampleReplayRequest(
        counterexample=cx_05,
        baselinePolicyText=valid_policy,
        candidatePolicyText=candidate_v13_policy,
        entities=entities,
    )

    result = engine.replay_counterexample(replay_req)
    assert result.isReproduced is True
    assert result.replayedBaselineDecision == AuthorizationDecision.DENY
    assert result.replayedCandidateDecision == AuthorizationDecision.ALLOW
    assert result.replayedTransition == BehavioralTransition.NEWLY_AUTHORIZED
    assert result.mismatchReason is None
    assert result.baselineEvidence is not None
    assert result.candidateEvidence is not None


def test_counterexample_replay_mismatch_honestly_reported(
    valid_policy, candidate_v13_policy, entities, scenarios_suite
):
    diff_service = CedarPolicyDiffService()
    engine = CounterexampleEngine()

    diff_report = diff_service.compare(
        PolicyDiffRequest(
            baselinePolicyText=valid_policy,
            candidatePolicyText=candidate_v13_policy,
            entities=entities,
            suite=scenarios_suite,
        )
    )

    counterexamples = engine.extract_counterexamples(
        scenario_diffs=diff_report.scenarioDiffs,
        baseline_label="v12",
        candidate_label="v13",
        entities=entities,
    )
    cx_05 = next(cx for cx in counterexamples if cx.scenarioId == "sc_05")

    # Pass baseline policy as candidate policy to simulate mismatch
    replay_req = CounterexampleReplayRequest(
        counterexample=cx_05,
        baselinePolicyText=valid_policy,
        candidatePolicyText=valid_policy,  # Mismatch: Candidate is same as baseline
        entities=entities,
    )

    result = engine.replay_counterexample(replay_req)
    assert result.isReproduced is False
    assert result.replayedCandidateDecision == AuthorizationDecision.DENY
    assert result.mismatchReason is not None
    assert "Replay decision mismatch" in result.mismatchReason
