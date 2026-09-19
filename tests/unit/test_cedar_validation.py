"""
Unit Tests for Cedar Policy Validation Service
"""

import pytest
from pathlib import Path
from backend.domain.cedar.validation import CedarValidationService
from backend.domain.cedar.engine import LocalCedarAdapter

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def validation_service():
    return CedarValidationService(engine=LocalCedarAdapter())


@pytest.fixture
def valid_policy_text():
    return (FIXTURES_DIR / "valid_policy.cedar").read_text()


@pytest.fixture
def invalid_policy_text():
    return (FIXTURES_DIR / "invalid_policy.cedar").read_text()


def test_validate_valid_cedar_policy(validation_service, valid_policy_text):
    """Test that a valid Cedar policy parses with isValid=True and zero errors."""
    result = validation_service.validate(valid_policy_text)
    assert result.isValid is True
    assert len(result.errors) == 0
    assert "cedar-wasm" in result.engine


def test_validate_invalid_cedar_policy(validation_service, invalid_policy_text):
    """Test that malformed Cedar syntax returns isValid=False with structured error diagnostics."""
    result = validation_service.validate(invalid_policy_text)
    assert result.isValid is False
    assert len(result.errors) > 0
    first_error = result.errors[0]
    assert "failed to parse" in first_error.message or "unexpected token" in first_error.message
    assert len(first_error.sourceLocations) > 0


def test_validate_empty_policy(validation_service):
    """Test that empty or whitespace-only policy string returns a graceful validation error."""
    result = validation_service.validate("   ")
    assert result.isValid is False
    assert len(result.errors) > 0
    assert "empty" in result.errors[0].message.lower()


def test_validate_simple_permit(validation_service):
    """Test validating a minimal valid permit policy."""
    policy = 'permit(principal == User::"alice", action == Action::"view", resource == Invoice::"inv-1");'
    result = validation_service.validate(policy)
    assert result.isValid is True
    assert len(result.errors) == 0
