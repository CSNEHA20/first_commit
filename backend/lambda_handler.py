"""
PolicyLab AWS Lambda Dual-Mode Entrypoint (Phase 8 Stage F & G)
Provides dual dispatch:
1. Step Functions Direct Task Dispatcher: Synchronously handles task payloads
   from infrastructure/statemachines/audit_workflow.asl.json.
2. HTTP API Gateway Dispatcher: Routes HTTP requests through Mangum to FastAPI.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict
from mangum import Mangum

from backend.main import (
    app,
    validation_service,
    regression_engine,
    explanation_service,
    repository,
)
from backend.domain.models.scenario import ScenarioSuite
from backend.domain.models.contract import SecurityContract
from backend.domain.models.regression import RegressionRunRequest
from backend.core.logging import get_logger, set_correlation_id

logger = get_logger("policylab.lambda")

_mangum_cache: Dict[str, Mangum] = {}


def _get_mangum(base_path: str = "/") -> Mangum:
    if base_path not in _mangum_cache:
        _mangum_cache[base_path] = Mangum(app, lifespan="off", api_gateway_base_path=base_path)
    return _mangum_cache[base_path]


mangum_handler = _get_mangum("/")


def handle_step_functions_task(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Executes tasks invoked directly by AWS Step Functions audit workflow.
    """
    op = event.get("operation")
    cid = event.get("correlationId") or set_correlation_id()
    logger.info("Handling Step Functions task", extra={"extra_data": {"operation": op, "correlationId": cid}})

    if op == "validate_policy":
        policy_text = event.get("policyText", "")
        schema_text = event.get("schemaText")
        val_res = validation_service.validate(policy_text=policy_text, schema_text=schema_text)
        return {
            "isValid": val_res.isValid,
            "errors": [e.message if hasattr(e, "message") else str(e) for e in val_res.errors],
            "warnings": [w.message if hasattr(w, "message") else str(w) for w in val_res.warnings],
            "engine": val_res.engine,
            "candidatePolicyText": policy_text,
            "schemaText": schema_text,
        }

    elif op == "run_regression":
        baseline_policy = event.get("baselinePolicyText", "")
        candidate_policy = event.get("candidatePolicyText", "")
        schema_text = event.get("schemaText")
        suite_raw = event.get("suite", {})
        suite = ScenarioSuite(**suite_raw) if isinstance(suite_raw, dict) else suite_raw
        contracts_raw = event.get("contracts", [])
        contracts = [SecurityContract(**c) if isinstance(c, dict) else c for c in contracts_raw]

        reg_request = RegressionRunRequest(
            baselinePolicyText=baseline_policy,
            candidatePolicyText=candidate_policy,
            schemaText=schema_text,
            suite=suite,
            contracts=contracts,
            baselineLabel=event.get("baselineLabel", "baseline"),
            candidateLabel=event.get("candidateLabel", "candidate"),
        )
        reg_report = regression_engine.run_regression(reg_request)
        return reg_report.model_dump()

    elif op in ("explain_violation", "explain_pass"):
        reg_report_data = event.get("regressionReport", {})
        gate_status = reg_report_data.get("gateDecision", {}).get("status", "UNKNOWN")
        summary = (
            f"Automated audit verification completed with gate status '{gate_status}'. "
            f"Analyzed {len(reg_report_data.get('scenarioResults', []))} scenarios."
        )
        return {
            "operation": op,
            "status": gate_status,
            "summary": summary,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "regressionReport": reg_report_data,
        }

    elif op == "persist_audit_report":
        audit_data = event.get("auditData", {})
        audit_id = audit_data.get("id") or f"audit_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        audit_record = {
            "id": audit_id,
            "data": audit_data,
            "savedAt": datetime.now(timezone.utc).isoformat(),
        }
        repository.save_audit_run(audit_record)
        return {
            "status": "SUCCESS",
            "auditId": audit_id,
            "message": "Audit report persisted successfully.",
        }

    else:
        raise ValueError(f"Unknown Step Functions task operation '{op}'.")


def handler(event: Dict[str, Any], context: Any) -> Any:
    """
    Main AWS Lambda entrypoint with dual dispatch.
    """
    # Check if event is a direct Step Functions task invocation
    if isinstance(event, dict) and "operation" in event:
        return handle_step_functions_task(event, context)

    # Otherwise, handle via Mangum ASGI adapter for API Gateway HTTP API
    # Detect stage prefix in API Gateway HTTP API (e.g. /dev, /staging, /prod)
    base_path = "/"
    if isinstance(event, dict):
        rc = event.get("requestContext")
        if isinstance(rc, dict):
            stage = rc.get("stage", "")
            http_info = rc.get("http", {})
            path = http_info.get("path", "") if isinstance(http_info, dict) else ""
            if stage and stage != "$default" and (path.startswith(f"/{stage}/") or path == f"/{stage}"):
                base_path = f"/{stage}"

    return _get_mangum(base_path)(event, context)
