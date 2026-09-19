"""
PolicyLab Structured Logging & CloudWatch Observability (Phase 8 Stage H)
Provides structured JSON log formatting, request correlation ID tracking,
CloudWatch Embedded Metric Format (EMF) emission, and sanitized error logging.
"""

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import re
import uuid
from typing import Any, Dict, Optional

correlation_id_ctx: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)

# Pattern to redact common secret tokens and AWS keys from log messages
SENSITIVE_PATTERNS = [
    (re.compile(r"(?i)(aws_secret_access_key|secret_key|password|bearer|token)\s*[:=]\s*['\"]?([^'\"\s]+)['\"]?"), r"\1=***REDACTED***"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), r"AKIA***REDACTED***"),
]


def sanitize_log_text(text: str) -> str:
    """Redacts potential secrets, credentials, and tokens from log messages."""
    sanitized = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line structured JSON objects for CloudWatch Logs."""

    def format(self, record: logging.LogRecord) -> str:
        raw_msg = record.getMessage()
        clean_msg = sanitize_log_text(raw_msg)

        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": clean_msg,
            "correlationId": correlation_id_ctx.get() or "none",
        }
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            # Sanitize any string values in extra_data
            clean_extra = {}
            for k, v in record.extra_data.items():
                clean_extra[k] = sanitize_log_text(str(v)) if isinstance(v, str) else v
            log_entry.update(clean_extra)

        if record.exc_info:
            clean_exc = sanitize_log_text(self.formatException(record.exc_info))
            log_entry["exception"] = clean_exc

        return json.dumps(log_entry)


def setup_structured_logging(level: int = logging.INFO) -> logging.Logger:
    """Configures the root logger with the structured JSON formatter."""
    logger = logging.getLogger("policylab")
    logger.setLevel(level)

    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(handler)
    return logger


logger = setup_structured_logging()


def get_logger(name: str = "policylab") -> logging.Logger:
    return logging.getLogger(name)


def set_correlation_id(cid: Optional[str] = None) -> str:
    new_id = cid or f"req_{uuid.uuid4().hex[:8]}"
    correlation_id_ctx.set(new_id)
    return new_id


def log_operational_metric(
    metric_name: str,
    value: float = 1.0,
    unit: str = "Count",
    dimensions: Optional[Dict[str, str]] = None,
    namespace: str = "PolicyLab",
) -> None:
    """
    Emits an operational metric using CloudWatch Embedded Metric Format (EMF).
    CloudWatch automatically extracts metrics from stdout JSON logs without extra SDK calls.
    """
    dims = dimensions or {"Environment": "production"}
    dim_keys = list(dims.keys())
    timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    emf_payload: Dict[str, Any] = {
        "_aws": {
            "Timestamp": timestamp_ms,
            "CloudWatchMetrics": [
                {
                    "Namespace": namespace,
                    "Dimensions": [dim_keys],
                    "Metrics": [{"Name": metric_name, "Unit": unit}],
                }
            ],
        },
        metric_name: value,
        "correlationId": correlation_id_ctx.get() or "none",
    }
    emf_payload.update(dims)

    # Log as structured info line for CloudWatch extraction
    logger.info(f"METRIC {metric_name}={value}", extra={"extra_data": emf_payload})
