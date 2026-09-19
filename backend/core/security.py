"""
PolicyLab Security & Reliability Guards (Stage K)
Enforces payload constraints, input size limits, and protects against resource exhaustion attacks.
Guarantees failure conditions fail closed and never yield false ALLOW authorization grants.
"""

from typing import Any, Dict, List, Optional

MAX_POLICY_SIZE_BYTES = 100 * 1024       # 100 KB max policy size
MAX_ENTITIES_COUNT = 5000                # 5,000 entities max per snapshot
MAX_SCENARIOS_COUNT = 1000               # 1,000 scenarios max per batch run
MAX_PROMPT_LENGTH = 4000                 # 4,000 characters max for generator prompt


class SecurityPayloadLimitException(ValueError):
    """Raised when an incoming request exceeds safety size limits."""
    pass


def enforce_policy_size_limit(policy_text: str, label: str = "Policy") -> None:
    """Enforces upper bound on Cedar policy code size to prevent denial of service."""
    if not policy_text:
        return
    size = len(policy_text.encode("utf-8"))
    if size > MAX_POLICY_SIZE_BYTES:
        raise SecurityPayloadLimitException(
            f"{label} size ({size} bytes) exceeds maximum allowable limit ({MAX_POLICY_SIZE_BYTES} bytes)."
        )


def enforce_scenario_count_limit(scenarios: List[Any]) -> None:
    """Enforces bound on scenario suite size to prevent evaluation timeouts."""
    if len(scenarios) > MAX_SCENARIOS_COUNT:
        raise SecurityPayloadLimitException(
            f"Scenario suite contains {len(scenarios)} scenarios, exceeding maximum limit ({MAX_SCENARIOS_COUNT})."
        )


def enforce_entity_count_limit(entities: List[Any]) -> None:
    """Enforces bound on entity graph size to prevent memory exhaustion."""
    if len(entities) > MAX_ENTITIES_COUNT:
        raise SecurityPayloadLimitException(
            f"Entity graph contains {len(entities)} records, exceeding maximum limit ({MAX_ENTITIES_COUNT})."
        )


def enforce_prompt_limit(prompt: str) -> None:
    """Enforces bound on AI policy generator prompts to prevent token exhaustion."""
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise SecurityPayloadLimitException(
            f"Generator prompt ({len(prompt)} chars) exceeds maximum limit ({MAX_PROMPT_LENGTH} chars)."
        )
