"""
PolicyLab Structured Logging & CloudWatch Observability (Stage I3)
Provides structured JSON log formatting, request correlation ID tracking,
and sanitized error logging for operational visibility.
"""

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import uuid
from typing import Any, Dict, Optional

correlation_id_ctx: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line structured JSON objects for CloudWatch Logs."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlationId": correlation_id_ctx.get() or "none",
        }
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_entry.update(record.extra_data)
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
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
