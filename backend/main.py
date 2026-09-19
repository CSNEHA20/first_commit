"""
PolicyLab Backend API Service
FastAPI REST interface exposing deterministic Cedar validation, single evaluation, and batch scenario simulation.
"""

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
from .domain.cedar.validation import CedarValidationService
from .domain.cedar.evaluation import CedarEvaluationService
from .domain.cedar.runner import ScenarioRunner
from .domain.cedar.engine import LocalCedarAdapter

app = FastAPI(
    title="PolicyLab Deterministic Authorization & Scenario Engine API",
    description="Deterministic Cedar policy validation, authorization evaluation, and scenario runner service.",
    version="1.1.0",
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
cedar_adapter = LocalCedarAdapter()


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
