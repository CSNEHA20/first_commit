"""
PolicyLab Backend API Service
FastAPI REST interface exposing deterministic Cedar validation, single evaluation,
batch scenario simulation, policy diff comparison, counterexample extraction & replay,
security contract evaluation, pre-deployment regression gates, grounded AI explanations,
and human-approved Amazon Verified Permissions (AVP) deployment.
"""

from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .core.logging import log_operational_metric, set_correlation_id
from .core.aws_config import aws_config, AWSClusterStatus
from .domain.models.authz import (
    AuthorizationRequest,
    CanonicalEvidence,
    PolicyValidationRequest,
    PolicyValidationResponse,
)
from .domain.models.scenario import (
    BatchSimulationRequest,
    ScenarioSuite,
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
    SecurityContract,
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
from .domain.models.entity import (
    EntitySnapshot,
    FixtureEntityProvider,
)
from .domain.cedar.validation import CedarValidationService
from .domain.cedar.evaluation import CedarEvaluationService
from .domain.cedar.runner import ScenarioRunner
from .domain.cedar.diff import CedarPolicyDiffService
from .domain.cedar.counterexample import CounterexampleEngine
from .domain.cedar.contract import SecurityContractService
from .domain.cedar.regression import RegressionEngine
from .domain.cedar.engine import LocalCedarAdapter
from .domain.cedar.input_validation import (
    CedarInputValidationService,
    EnforcedEvaluationPipeline,
    MultiStageValidationReport,
)
from .domain.cedar.matrix import AccessMatrixReport, AccessMatrixService
from .domain.cedar.whatif import WhatIfSimulationResponse, WhatIfSimulatorService
from .domain.persistence.repository import InMemoryPolicyLabRepository
from .domain.persistence.timeline import PolicyVersionTimelineEntry, VersionTimelineService
from .domain.ai.explanation import AIExplanationService
from .domain.ai.generator import (
    PolicyGenerationRequest,
    PolicyGenerationResponse,
    PolicyGeneratorService,
)
from .domain.ai.agent import AuditWorkflowReport, PolicyAuditAgent
from .domain.ai.report_export import AuditExportResponse, AuditReportExportService
from .domain.avp.adapter import DeploymentService

app = FastAPI(
    title="PolicyLab Deterministic Authorization, Verification, AI & AVP Deployment API",
    description="Deterministic Cedar policy verification, counterexamples, contracts, regression gates, Bedrock explanations, and AVP synchronization.",
    version="1.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    cid = request.headers.get("X-Correlation-ID")
    set_correlation_id(cid)
    response = await call_next(request)
    return response


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

# Phase 7 Newly Integrated Domain Services
input_validator = CedarInputValidationService(policy_validator=validation_service)
enforced_pipeline = EnforcedEvaluationPipeline(validator=input_validator, evaluator=evaluation_service)
matrix_service = AccessMatrixService(evaluation_service=evaluation_service)
whatif_service = WhatIfSimulatorService(regression_engine=regression_engine)
repository = InMemoryPolicyLabRepository()
timeline_service = VersionTimelineService(repository=repository)
fixture_entity_provider = FixtureEntityProvider()
policy_generator = PolicyGeneratorService(validator=validation_service)
audit_agent = PolicyAuditAgent(
    validation_service=validation_service,
    diff_service=diff_service,
    counterexample_engine=counterexample_engine,
    contract_service=contract_service,
    regression_engine=regression_engine,
    explanation_service=explanation_service,
)
report_exporter = AuditReportExportService()


@app.get("/health")
def get_health():
    """Health check endpoint returning Cedar engine and AWS environment status."""
    try:
        versions = cedar_adapter.get_version()
        return {
            "status": "healthy",
            "engine": "Cedar WASM",
            "cedarVersion": versions.get("cedarVersion", "4.13.0"),
            "cedarLangVersion": versions.get("cedarLangVersion", "4.5"),
            "environment": aws_config.environment,
            "awsRegion": aws_config.region,
            "credentialsDetected": aws_config.has_aws_credentials(),
        }
    except Exception as ex:
        return {
            "status": "degraded",
            "error": str(ex),
        }


@app.get("/aws/status", response_model=AWSClusterStatus)
def get_aws_status():
    """
    Audits and returns the truthful operational status of all AWS service integrations.
    Distinguishes LIVE, LOCAL_MOCKED, and NOT_CONFIGURED states.
    """
    return aws_config.audit_environment()


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
        prep_res = deployment_service.prepare_deployment(request)
        if not prep_res.isEligible:
            log_operational_metric(
                "DeploymentBlocked", 1.0, unit="Count", dimensions={"TargetEnv": prep_res.targetEnv}
            )
        else:
            log_operational_metric(
                "DeploymentPrepared", 1.0, unit="Count", dimensions={"TargetEnv": prep_res.targetEnv}
            )
        return prep_res
    except Exception as ex:
        log_operational_metric("DeploymentPrepareFailure", 1.0, unit="Count")
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
        appr_res = deployment_service.register_approval(request)
        log_operational_metric("HumanApprovalGranted", 1.0, unit="Count")
        return appr_res
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
        submit_res = deployment_service.submit_deployment(request)
        log_operational_metric(
            "DeploymentSubmitted", 1.0, unit="Count", dimensions={"Status": submit_res.status.value}
        )
        return submit_res
    except ValueError as ve:
        log_operational_metric("DeploymentSubmissionRejected", 1.0, unit="Count")
        raise HTTPException(
            status_code=400,
            detail=str(ve),
        )
    except Exception as ex:
        log_operational_metric("DeploymentSubmissionError", 1.0, unit="Count")
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


# --- Phase 7 Newly Implemented Endpoints ---


class FullValidationRequest(BaseModel):
    policyText: str
    principal: str
    action: str
    resource: str
    context: Dict[str, Any] = Field(default_factory=dict)
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    schemaText: Optional[str] = None


@app.post("/validate-inputs", response_model=MultiStageValidationReport)
def validate_inputs(request: FullValidationRequest):
    """
    Exhaustive multi-stage input validation boundary checking policy syntax,
    schema compatibility, entity graph structure, and request/context types.
    """
    try:
        return input_validator.validate_full_pipeline(
            policy_text=request.policyText,
            principal=request.principal,
            action=request.action,
            resource=request.resource,
            context=request.context,
            entities=request.entities,
            schema_text=request.schemaText,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Input validation error: {str(ex)}",
        )


@app.post("/policies/generate", response_model=PolicyGenerationResponse)
def generate_policy(request: PolicyGenerationRequest):
    """
    Synthesizes a candidate Cedar policy draft from natural language requirements
    using Amazon Bedrock with automatic syntax validation. (Draft remains UNTRUSTED).
    """
    try:
        return policy_generator.generate_candidate_policy(request)
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=str(ve),
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Policy generation error: {str(ex)}",
        )


class AgentAuditRequest(BaseModel):
    baselinePolicyText: str
    candidatePolicyText: str
    suite: ScenarioSuite
    contracts: Optional[List[SecurityContract]] = None
    schemaText: Optional[str] = None
    entities: Optional[List[Dict[str, Any]]] = None
    baselineLabel: str = "Baseline Production (v12)"
    candidateLabel: str = "Candidate Release (v13)"
    runAiExplanation: bool = True


@app.post("/audits/agent-run", response_model=AuditWorkflowReport)
def run_agent_audit(request: AgentAuditRequest):
    """
    Executes an end-to-end security audit orchestrated by PolicyAuditAgent.
    Deterministic Cedar tools own authorization results.
    """
    try:
        return audit_agent.execute_audit(
            baseline_policy_text=request.baselinePolicyText,
            candidate_policy_text=request.candidatePolicyText,
            suite=request.suite,
            contracts=request.contracts,
            schema_text=request.schemaText,
            entities=request.entities,
            baseline_label=request.baselineLabel,
            candidate_label=request.candidateLabel,
            run_ai_explanation=request.runAiExplanation,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Audit agent orchestration failed: {str(ex)}",
        )


class AuditExportRequest(BaseModel):
    report: AuditWorkflowReport
    format: str = "markdown"


@app.post("/audits/export", response_model=AuditExportResponse)
def export_audit_report(request: AuditExportRequest):
    """
    Exports a structured audit report in Markdown or JSON format.
    """
    try:
        return report_exporter.export_report(
            audit_report=request.report, export_format=request.format
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Audit export error: {str(ex)}",
        )


class AccessMatrixRequest(BaseModel):
    policyText: str
    principals: List[str]
    actions: List[str]
    resources: List[str]
    entities: Optional[List[Dict[str, Any]]] = None
    schemaText: Optional[str] = None
    baselinePolicyText: Optional[str] = None


@app.post("/matrix/evaluate", response_model=AccessMatrixReport)
def evaluate_access_matrix(request: AccessMatrixRequest):
    """
    Evaluates effective authorization surface across Principals x (Actions x Resources)
    and indicates behavioral changes against an optional baseline policy.
    """
    try:
        return matrix_service.generate_matrix(
            policy_text=request.policyText,
            principals=request.principals,
            actions=request.actions,
            resources=request.resources,
            entities=request.entities,
            schema_text=request.schemaText,
            baseline_policy_text=request.baselinePolicyText,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Matrix evaluation failed: {str(ex)}",
        )


class WhatIfRequest(BaseModel):
    baselinePolicyText: str
    proposedPolicyText: str
    suite: ScenarioSuite
    schemaText: Optional[str] = None
    entities: Optional[List[Dict[str, Any]]] = None


@app.post("/simulator/what-if", response_model=WhatIfSimulationResponse)
def simulate_what_if(request: WhatIfRequest):
    """
    Calculates impact metrics and gate readiness for a proposed policy modification.
    """
    try:
        return whatif_service.simulate_what_if(
            baseline_policy_text=request.baselinePolicyText,
            proposed_policy_text=request.proposedPolicyText,
            suite=request.suite,
            schema_text=request.schemaText,
            entities=request.entities,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"What-If simulation failed: {str(ex)}",
        )


@app.get("/policies/{set_id}/timeline", response_model=List[PolicyVersionTimelineEntry])
def get_policy_timeline(set_id: str):
    """
    Retrieves chronological version history for a PolicySet.
    """
    return timeline_service.get_timeline(set_id)


class RecordVersionRequest(BaseModel):
    versionTag: str
    policyText: str
    author: str
    changeSummary: str
    gateStatus: str = "PENDING"


@app.post("/policies/{set_id}/versions", response_model=PolicyVersionTimelineEntry)
def record_policy_version(set_id: str, request: RecordVersionRequest):
    """
    Records a new immutable policy version in the repository.
    """
    try:
        return timeline_service.record_version(
            set_id=set_id,
            version_tag=request.versionTag,
            policy_text=request.policyText,
            author=request.author,
            change_summary=request.changeSummary,
            gate_status=request.gateStatus,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record version: {str(ex)}",
        )


class CreateSnapshotRequest(BaseModel):
    snapshotId: Optional[str] = None
    schemaVersion: Optional[str] = None
    uids: Optional[List[str]] = None


@app.post("/entity-snapshots", response_model=EntitySnapshot)
def create_entity_snapshot(request: CreateSnapshotRequest):
    """
    Creates an immutable, bounded entity snapshot with SHA-256 integrity verification.
    """
    try:
        scope = {"uids": request.uids} if request.uids else None
        return fixture_entity_provider.create_snapshot(
            entity_scope=scope,
            snapshot_id=request.snapshotId,
            schema_version=request.schemaVersion,
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create snapshot: {str(ex)}",
        )


@app.get("/entity-snapshots/{snapshot_id}", response_model=EntitySnapshot)
def get_entity_snapshot(snapshot_id: str):
    """
    Retrieves a bounded entity snapshot by ID.
    """
    try:
        return fixture_entity_provider.load_snapshot(snapshot_id)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot '{snapshot_id}' not found.",
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Snapshot retrieval error: {str(ex)}",
        )
