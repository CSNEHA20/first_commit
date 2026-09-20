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
try:
    from mangum import Mangum
except ImportError:
    class Mangum:  # type: ignore
        """Fallback adapter for local test environments without mangum installed."""
        def __init__(self, app: Any, lifespan: str = "off", api_gateway_base_path: str = "/"):
            self.app = app
            self.lifespan = lifespan
            self.base_path = api_gateway_base_path

        def __call__(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
            import asyncio
            import base64

            http_info = event.get("requestContext", {}).get("http", {})
            method = (http_info.get("method") or event.get("httpMethod") or "GET").upper()
            path = http_info.get("path") or event.get("rawPath") or event.get("path") or "/"
            query_string = (event.get("rawQueryString") or "").encode("latin-1")

            headers = []
            for k, v in (event.get("headers") or {}).items():
                headers.append((k.lower().encode("latin-1"), str(v).encode("latin-1")))

            body = event.get("body") or ""
            if event.get("isBase64Encoded") and body:
                body_bytes = base64.b64decode(body)
            else:
                body_bytes = body.encode("utf-8") if isinstance(body, str) else b""

            response_status = 200
            response_headers = []
            response_body_parts = []

            async def receive():
                return {"type": "http.request", "body": body_bytes, "more_body": False}

            async def send(message):
                nonlocal response_status, response_headers, response_body_parts
                if message["type"] == "http.response.start":
                    response_status = message["status"]
                    response_headers = message.get("headers", [])
                elif message["type"] == "http.response.body":
                    response_body_parts.append(message.get("body", b""))

            scope = {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": method,
                "path": path,
                "raw_path": path.encode("latin-1"),
                "query_string": query_string,
                "headers": headers,
                "aws.event": event,
                "aws.context": context,
            }

            try:
                loop = asyncio.get_event_loop()
                if loop.is_closed():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            loop.run_until_complete(self.app(scope, receive, send))

            return {
                "statusCode": response_status,
                "headers": {k.decode("latin-1"): v.decode("latin-1") for k, v in response_headers},
                "body": b"".join(response_body_parts).decode("utf-8", errors="replace"),
                "isBase64Encoded": False,
            }

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
