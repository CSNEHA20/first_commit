"""
PolicyLab Backend API Service
FastAPI REST interface exposing deterministic Cedar validation, single evaluation,
batch scenario simulation, policy diff comparison, counterexample extraction & replay,
security contract evaluation, pre-deployment regression gates, grounded AI explanations,
and human-approved Amazon Verified Permissions (AVP) deployment.
"""

from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .domain.models.authz import (
    AuthorizationRequest,
    CanonicalEvidence,
    PolicyValidationRequest,
    PolicyValidationResponse,
)
from .domain.models.scenario import (
    BatchSimulationRequest,
    SimulationRun,
)
from .domain.models.diff import (
    PolicyDiffReport,
    PolicyDiffRequest,
)
from .domain.models.counterexample import (
    Counterexample,
    CounterexampleReplayRequest,
    CounterexampleReplayResult,
)
from .domain.models.contract import (
    ContractEvaluationReport,
    ContractEvaluationRequest,
)
from .domain.models.regression import (
    RegressionReport,
    RegressionRunRequest,
)
from .domain.models.explanation import (
    AIExplanationRequest,
    AIExplanationResponse,
)
from .domain.models.deployment import (
    AVPReadinessResponse,
    DeploymentPrepareRequest,
    DeploymentPrepareResponse,
    DeploymentRecord,
    DeploymentSubmitRequest,
    DeploymentSubmitResponse,
    HumanApprovalRequest,
    HumanApprovalResponse,
)
from .domain.cedar.validation import CedarValidationService
from .domain.cedar.evaluation import CedarEvaluationService
from .domain.cedar.runner import ScenarioRunner
from .domain.cedar.diff import CedarPolicyDiffService
from .domain.cedar.counterexample import CounterexampleEngine
from .domain.cedar.contract import SecurityContractService
from .domain.cedar.regression import RegressionEngine
from .domain.cedar.engine import LocalCedarAdapter
from .domain.ai.explanation import AIExplanationService
from .domain.avp.adapter import DeploymentService

app = FastAPI(
    title="PolicyLab Deterministic Authorization, Verification, AI & AVP Deployment API",
    description="Deterministic Cedar policy verification, counterexamples, contracts, regression gates, Bedrock explanations, and AVP synchronization.",
    version="1.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

validation_service = CedarValidationService()
evaluation_service = CedarEvaluationService()
scenario_runner = ScenarioRunner()
diff_service = CedarPolicyDiffService(
    scenario_runner=scenario_runner, validation_service=validation_service
)
counterexample_engine = CounterexampleEngine(evaluation_service=evaluation_service)
contract_service = SecurityContractService(
    scenario_runner=scenario_runner, validation_service=validation_service
)
regression_engine = RegressionEngine(
    diff_service=diff_service,
    counterexample_engine=counterexample_engine,
    contract_service=contract_service,
    validation_service=validation_service,
)
cedar_adapter = LocalCedarAdapter()
explanation_service = AIExplanationService()
deployment_service = DeploymentService()


@app.get("/health")
def get_health():
    """Health check endpoint returning Cedar engine version metadata."""
    try:
        versions = cedar_adapter.get_version()
        return {
            "status": "healthy",
            "engine": "Cedar WASM",
            "cedarVersion": versions.get("cedarVersion", "4.13.0"),
            "cedarLangVersion": versions.get("cedarLangVersion", "4.5"),
        }
    except Exception as ex:
        return {
            "status": "degraded",
            "error": str(ex),
        }


@app.post("/policies/validate", response_model=PolicyValidationResponse)
def validate_policy(request: PolicyValidationRequest):
    """Validates Cedar policy syntax and schema compatibility."""
    result = validation_service.validate(
        policy_text=request.policyText, schema_text=request.schemaText
    )
    return PolicyValidationResponse(
        isValid=result.isValid,
        errors=result.errors,
        warnings=result.warnings,
        engine=result.engine,
    )


@app.post("/simulate", response_model=CanonicalEvidence)
def simulate_authorization(request: AuthorizationRequest):
    """Deterministically evaluates a single authorization request against a Cedar policy set."""
    try:
        evidence = evaluation_service.evaluate(request)
        return evidence
    except Exception as ex:
        raise HTTPException(
            status_code=400,
            detail=f"Authorization evaluation failed: {str(ex)}",
        )


@app.post("/simulate/batch", response_model=SimulationRun)
def simulate_batch(request: BatchSimulationRequest):
    """
    Deterministically evaluates a suite of declared authorization scenarios
    against a Cedar policy set, returning a structured simulation matrix.
    """
    try:
        run_matrix = scenario_runner.run(request)
        return run_matrix
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid simulation request: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation runner execution failed: {str(ex)}",
        )


@app.post("/policies/diff", response_model=PolicyDiffReport)
def compare_policies(request: PolicyDiffRequest):
    """
    Deterministically compares baseline vs. candidate Cedar policy sets across
    the declared scenario universe, classifying behavioral transitions and
    computing bounded impact metrics.
    """
    try:
        report = diff_service.compare(request)
        return report
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Policy comparison failed: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Diff engine execution error: {str(ex)}",
        )


@app.post("/policies/counterexamples", response_model=List[Counterexample])
def get_counterexamples(request: PolicyDiffRequest):
    """
    Generates deterministic, concrete counterexamples from behavioral transitions
    between baseline and candidate policies.
    """
    try:
        diff_report = diff_service.compare(request)
        counterexamples = counterexample_engine.extract_counterexamples(
            scenario_diffs=diff_report.scenarioDiffs,
            baseline_label=request.baselineLabel,
            candidate_label=request.candidateLabel,
            entities=request.entities,
        )
        return counterexamples
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Counterexample extraction failed: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Counterexample extraction error: {str(ex)}",
        )


@app.post("/counterexamples/replay", response_model=CounterexampleReplayResult)
def replay_counterexample(request: CounterexampleReplayRequest):
    """
    Deterministically replays a counterexample vector against baseline and candidate
    policies using the live Cedar runtime path, verifying reproducibility.
    """
    try:
        replay_result = counterexample_engine.replay_counterexample(request)
        return replay_result
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Counterexample replay failed: {str(ex)}",
        )


@app.post("/contracts/evaluate", response_model=ContractEvaluationReport)
def evaluate_contracts(request: ContractEvaluationRequest):
    """
    Evaluates organizational security contracts against a policy set across a declared scenario suite.
    """
    try:
        report = contract_service.evaluate_standalone(request)
        return report
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Contract evaluation failed: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Contract evaluation error: {str(ex)}",
        )


@app.post("/policies/regression", response_model=RegressionReport)
def run_regression(request: RegressionRunRequest):
    """
    Executes an end-to-end regression evaluation between baseline and candidate policies,
    evaluating diff transitions, extracting counterexamples, checking security contracts,
    and computing the deterministic pre-deployment verification gate decision.
    """
    try:
        report = regression_engine.run_regression(request)
        return report
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Regression evaluation failed: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Regression engine error: {str(ex)}",
        )


# --- Phase 5 Endpoints ---


@app.post("/explanations", response_model=AIExplanationResponse)
def generate_explanation(request: AIExplanationRequest):
    """
    Synthesizes a structured, grounded AI explanation and remediation proposal
    from supplied deterministic authorization evidence.
    """
    try:
        explanation = explanation_service.explain(request)
        return explanation
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid evidence payload: {str(ve)}",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Explanation generation error: {str(ex)}",
        )


@app.get("/deployment/readiness", response_model=AVPReadinessResponse)
def get_deployment_readiness(region: str = "us-east-1", store_id: str = "ps-acmepay-prod"):
    """
    Checks AWS environment connection and Amazon Verified Permissions readiness.
    """
    try:
        return deployment_service.check_readiness(region=region, store_id=store_id)
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Readiness check failed: {str(ex)}",
        )


@app.post("/deployment/prepare", response_model=DeploymentPrepareResponse)
def prepare_deployment(request: DeploymentPrepareRequest):
    """
    Evaluates pre-deployment gate eligibility, calculates cryptographic policy hash,
    and creates a deployment preparation record.
    """
    try:
        return deployment_service.prepare_deployment(request)
    except Exception as ex:
        raise HTTPException(
            status_code=400,
            detail=f"Deployment preparation failed: {str(ex)}",
        )


@app.post("/deployment/approve", response_model=HumanApprovalResponse)
def approve_deployment(request: HumanApprovalRequest):
    """
    Registers explicit human operator sign-off for a specific prepared deployment and policy hash.
    """
    try:
        return deployment_service.register_approval(request)
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=str(ve),
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Human approval registration error: {str(ex)}",
        )


@app.post("/deployment/submit", response_model=DeploymentSubmitResponse)
def submit_deployment(request: DeploymentSubmitRequest):
    """
    Submits an approved policy set to Amazon Verified Permissions after validating human approval.
    """
    try:
        return deployment_service.submit_deployment(request)
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=str(ve),
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Deployment submission error: {str(ex)}",
        )


@app.get("/deployment/history", response_model=List[DeploymentRecord])
def get_deployment_history():
    """
    Retrieves the audit trail ledger of verified deployments.
    """
    return deployment_service.get_history()
