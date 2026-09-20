"""
PolicyLab Backend API Service
FastAPI REST interface exposing deterministic Cedar validation, single evaluation,
batch scenario simulation, policy diff comparison, counterexample extraction & replay,
security contract evaluation, pre-deployment regression gates, grounded AI explanations,
and human-approved Amazon Verified Permissions (AVP) deployment.
"""

import os
import logging
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("policylab.api")

from .core.auth import AuthenticatedUser, get_current_user, require_roles
from .core.logging import log_operational_metric, set_correlation_id
from .core.aws_config import aws_config, AWSClusterStatus, _load_dotenv

_load_dotenv()
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
from .domain.persistence.repository import IPolicyLabRepository, InMemoryPolicyLabRepository
from .domain.persistence.aws_repository import (
    DynamoDBPolicyLabRepository,
    S3ArtifactRepository,
)
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

env = os.environ.get("ENVIRONMENT", "dev").lower()
is_prod = env == "prod"

app = FastAPI(
    title="PolicyLab Deterministic Authorization, Verification, AI & AVP Deployment API",
    description="Deterministic Cedar policy verification, counterexamples, contracts, regression gates, Bedrock explanations, and AVP synchronization.",
    version="1.5.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
)

allowed_origins = [
    os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173"),
    "https://main.d2np06j97bpfgw.amplifyapp.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    cid = request.headers.get("X-Correlation-ID")
    actual_cid = set_correlation_id(cid)
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = actual_cid
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

if os.environ.get("AWS_DYNAMODB_ENABLED") == "true":
    repository: IPolicyLabRepository = DynamoDBPolicyLabRepository(
        table_name=aws_config.dynamodb_table, region=aws_config.region
    )
else:
    repository: IPolicyLabRepository = InMemoryPolicyLabRepository()

artifact_repository = S3ArtifactRepository(
    bucket_name=aws_config.artifact_bucket, region=aws_config.region
)

deployment_service = DeploymentService(repository=repository)

# Phase 7 Newly Integrated Domain Services
input_validator = CedarInputValidationService(policy_validator=validation_service)
enforced_pipeline = EnforcedEvaluationPipeline(validator=input_validator, evaluator=evaluation_service)
matrix_service = AccessMatrixService(evaluation_service=evaluation_service)
whatif_service = WhatIfSimulatorService(regression_engine=regression_engine)
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


@app.get("/")
def get_root():
    """Root endpoint providing service metadata and Cedar engine status."""
    return {
        "service": "PolicyLab API",
        "status": "online",
        "environment": aws_config.environment,
        "engine": "Cedar Deterministic Verification",
    }


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
def get_aws_status(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Audits and returns the truthful operational status of all AWS service integrations.
    Distinguishes LIVE, LOCAL_MOCKED, and NOT_CONFIGURED states.
    """
    return aws_config.audit_environment()


# ─── Connected Workspace Endpoints ────────────────────────────────────────────

class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    mode: str = Field(default="connected")


class WorkspaceResponse(BaseModel):
    workspaceId: str
    name: str
    mode: str
    description: Optional[str] = None
    createdAt: str
    scope: str = "LOCAL_SESSION"


@app.post("/workspaces", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    request: WorkspaceCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Creates a named Connected Workspace record in the session-scoped in-memory repository.
    Persistence scope: LOCAL_SESSION — data is not durable across server restarts.
    No Cedar policy data is stored here; Cedar evaluation uses the existing endpoints.
    """
    import uuid
    from datetime import datetime, timezone

    ws_id = f"ws_{uuid.uuid4().hex[:10]}"
    record = {
        "id": ws_id,
        "name": request.name,
        "mode": request.mode,
        "description": request.description,
        "createdBy": current_user.username,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "LOCAL_SESSION",
    }
    repository.save_workspace(record)
    return WorkspaceResponse(
        workspaceId=ws_id,
        name=record["name"],
        mode=record["mode"],
        description=record.get("description"),
        createdAt=record["createdAt"],
        scope="LOCAL_SESSION",
    )


@app.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieves a Connected Workspace record by ID from the session-scoped repository."""
    record = repository.get_workspace(workspace_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found.")
    return WorkspaceResponse(
        workspaceId=record["id"],
        name=record["name"],
        mode=record["mode"],
        description=record.get("description"),
        createdAt=record["createdAt"],
        scope="LOCAL_SESSION",
    )


@app.get("/workspaces", response_model=List[WorkspaceResponse])
def list_workspaces(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Lists all Connected Workspace records in the session-scoped in-memory repository."""
    records = repository.list_workspaces()
    return [
        WorkspaceResponse(
            workspaceId=r["id"],
            name=r["name"],
            mode=r["mode"],
            description=r.get("description"),
            createdAt=r["createdAt"],
            scope="LOCAL_SESSION",
        )
        for r in records
    ]


@app.post("/policies/validate", response_model=PolicyValidationResponse)
def validate_policy(request: PolicyValidationRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def simulate_authorization(request: AuthorizationRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def simulate_batch(request: BatchSimulationRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def compare_policies(request: PolicyDiffRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def get_counterexamples(request: PolicyDiffRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def replay_counterexample(request: CounterexampleReplayRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def evaluate_contracts(request: ContractEvaluationRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def run_regression(request: RegressionRunRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
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
def generate_explanation(request: AIExplanationRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Synthesizes a structured, grounded AI explanation and remediation proposal
    from supplied deterministic authorization evidence.
    """
    try:
        provider_cls = type(explanation_service.provider).__name__
        logger.info(f"Generating explanation using provider: {provider_cls}")
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
def get_deployment_readiness(
    region: str = "us-east-1",
    store_id: str = "ps-acmepay-prod",
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def prepare_deployment(
    request: DeploymentPrepareRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["engineer", "approver", "deployer", "admin"])),
):
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
def approve_deployment(
    request: HumanApprovalRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["approver", "admin"])),
):
    """
    Registers explicit human operator sign-off for a specific prepared deployment and policy hash.
    Requires 'approver' or 'admin' platform role.
    """
    try:
        # If approver wasn't explicitly named in request payload, bind to authenticated user
        if not (request.operatorName or request.approverName):
            request.operatorName = current_user.username
            request.approverName = current_user.username
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
def submit_deployment(
    request: DeploymentSubmitRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["deployer", "admin"])),
):
    """
    Submits an approved policy set to Amazon Verified Permissions after validating human approval.
    Requires 'deployer' or 'admin' platform role.
    """
    try:
        submit_res = deployment_service.submit_deployment(request, deployed_by=current_user.username)
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
def get_deployment_history(current_user: AuthenticatedUser = Depends(get_current_user)):
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
def validate_inputs(
    request: FullValidationRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def generate_policy(
    request: PolicyGenerationRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["engineer", "admin"])),
):
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
def run_agent_audit(
    request: AgentAuditRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Executes an end-to-end security audit orchestrated by PolicyAuditAgent.
    Deterministic Cedar tools own authorization results.
    """
    try:
        report = audit_agent.execute_audit(
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
        try:
            repository.save_audit_run({
                "id": report.auditRunId,
                "timestamp": report.timestamp,
                "status": report.status.value if hasattr(report.status, "value") else str(report.status),
                "gateDecision": report.gateDecision.value if hasattr(report.gateDecision, "value") else str(report.gateDecision),
                "summary": report.summary,
                "data": report.model_dump(),
            })
        except Exception as save_err:
            logger.warning(f"Could not persist audit run to repository: {save_err}")
        return report
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Audit agent orchestration failed: {str(ex)}",
        )


@app.get("/audits/{audit_id}")
def get_audit_report(
    audit_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves a previously persisted audit run report by ID.
    """
    rec = repository.get_audit_run(audit_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Audit run '{audit_id}' not found.")
    return rec.get("data", rec)


class AsyncAuditStartResponse(BaseModel):
    executionArn: str
    startDate: str
    status: str
    stateMachineArn: str
    message: str


class AsyncAuditStatusResponse(BaseModel):
    executionArn: str
    status: str
    startDate: Optional[str] = None
    stopDate: Optional[str] = None
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    cause: Optional[str] = None


@app.post("/audits/async-run", response_model=AsyncAuditStartResponse)
def run_async_audit(
    request: AgentAuditRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Initiates an asynchronous verification workflow via AWS Step Functions.
    Requires AUDIT_STATE_MACHINE_ARN configured and active AWS credentials with states:StartExecution.
    If unconfigured or inaccessible, returns an explicit error explaining the requirement
    and directing to the synchronous Strands audit endpoint /audits/agent-run.
    """
    sfn_arn = os.environ.get("AUDIT_STATE_MACHINE_ARN") or aws_config.state_machine_arn
    if not sfn_arn:
        raise HTTPException(
            status_code=400,
            detail=(
                "AWS Step Functions state machine ARN is not configured. "
                "Set AUDIT_STATE_MACHINE_ARN in your environment to the deployed "
                "PolicyAuditWorkflow state machine ARN. "
                "For local deterministic execution or interactive demonstration, "
                "use the Strands orchestration endpoint: POST /audits/agent-run."
            ),
        )

    try:
        import json
        import uuid
        import boto3
        sfn_client = boto3.client("stepfunctions", region_name=aws_config.region)
        payload = {
            "candidatePolicyText": request.candidatePolicyText,
            "baselinePolicyText": request.baselinePolicyText,
            "schemaText": request.schemaText,
            "suite": request.suite.model_dump(),
            "contracts": [c.model_dump() for c in request.contracts] if request.contracts else [],
            "entities": request.entities or [],
            "baselineLabel": request.baselineLabel,
            "candidateLabel": request.candidateLabel,
        }
        exec_name = f"audit-{uuid.uuid4().hex[:12]}"
        response = sfn_client.start_execution(
            stateMachineArn=sfn_arn,
            name=exec_name,
            input=json.dumps(payload),
        )
        return AsyncAuditStartResponse(
            executionArn=response["executionArn"],
            startDate=response["startDate"].isoformat(),
            status="RUNNING",
            stateMachineArn=sfn_arn,
            message="Step Functions audit workflow execution initiated.",
        )
    except Exception as ex:
        logger.error("Failed to start Step Functions execution", extra={"extra_data": {"error": str(ex)}})
        raise HTTPException(
            status_code=503,
            detail=f"Failed to start Step Functions execution: {str(ex)}. Ensure AWS IAM role permits states:StartExecution on {sfn_arn}.",
        )


@app.get("/audits/executions/{execution_arn:path}", response_model=AsyncAuditStatusResponse)
def get_async_audit_status(
    execution_arn: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves the execution status and output of a Step Functions audit workflow.
    """
    try:
        import json
        import boto3
        sfn_client = boto3.client("stepfunctions", region_name=aws_config.region)
        desc = sfn_client.describe_execution(executionArn=execution_arn)

        parsed_output = None
        if "output" in desc and desc["output"]:
            try:
                parsed_output = json.loads(desc["output"])
            except Exception:
                parsed_output = {"raw": desc["output"][:1000]}

        return AsyncAuditStatusResponse(
            executionArn=desc["executionArn"],
            status=desc["status"],
            startDate=desc.get("startDate").isoformat() if desc.get("startDate") else None,
            stopDate=desc.get("stopDate").isoformat() if desc.get("stopDate") else None,
            output=parsed_output,
            error=desc.get("error"),
            cause=desc.get("cause"),
        )
    except Exception as ex:
        logger.error("Failed to describe Step Functions execution", extra={"extra_data": {"error": str(ex), "arn": execution_arn}})
        raise HTTPException(
            status_code=503,
            detail=f"Failed to query execution status from AWS Step Functions: {str(ex)}",
        )


class AuditExportRequest(BaseModel):
    report: AuditWorkflowReport
    format: str = "markdown"


@app.post("/audits/export", response_model=AuditExportResponse)
def export_audit_report(
    request: AuditExportRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def evaluate_access_matrix(
    request: AccessMatrixRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def simulate_what_if(
    request: WhatIfRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def get_policy_timeline(
    set_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
def record_policy_version(
    set_id: str,
    request: RecordVersionRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["engineer", "admin"])),
):
    """
    Records a new immutable policy version in the repository.
    Requires 'engineer' or 'admin' platform role.
    """
    try:
        return timeline_service.record_version(
            set_id=set_id,
            version_tag=request.versionTag,
            policy_text=request.policyText,
            author=current_user.username,
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
def create_entity_snapshot(
    request: CreateSnapshotRequest,
    current_user: AuthenticatedUser = Depends(require_roles(["engineer", "admin"])),
):
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
def get_entity_snapshot(
    snapshot_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
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
