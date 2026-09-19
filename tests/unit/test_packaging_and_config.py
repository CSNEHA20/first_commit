"""
Unit tests for PolicyLab pre-deployment infrastructure configuration,
packaging boundaries, and environment variable resolution.
"""

import os
from pathlib import Path
import pytest

from backend.lambda_handler import handler
from backend.core.aws_config import AWSConfig, AWSConfigurationError


def test_lambda_handler_is_callable():
    """Verifies that the dual-mode Lambda handler is importable and callable."""
    assert callable(handler)


def test_requirements_consistency():
    """Verifies that backend/requirements.txt exists and specifies essential runtime packages."""
    repo_root = Path(__file__).resolve().parents[2]
    req_path = repo_root / "backend" / "requirements.txt"
    assert req_path.exists(), "backend/requirements.txt must exist"

    content = req_path.read_text(encoding="utf-8")
    lines = [line.strip().lower() for line in content.splitlines() if line.strip() and not line.startswith("#")]
    package_names = [line.split(">=")[0].split("==")[0].split("<")[0].strip() for line in lines]

    essential_packages = ["fastapi", "uvicorn", "pydantic", "boto3", "mangum"]
    for pkg in essential_packages:
        assert pkg in package_names, f"Essential package '{pkg}' missing from backend/requirements.txt"


def test_aws_config_strict_mode_resolution(monkeypatch):
    """Verifies AWSConfig validates the newly added environment variables in strict mode."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("STRICT_AWS", "true")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("POLICYLAB_DYNAMODB_TABLE", "PolicyLab-prod")
    monkeypatch.setenv("POLICYLAB_ARTIFACT_BUCKET", "policylab-artifacts-prod")
    monkeypatch.setenv("AVP_POLICY_STORE_ID", "ps-acmepay-prod")
    monkeypatch.setenv("AUDIT_STATE_MACHINE_ARN", "arn:aws:states:us-east-1:123456789012:stateMachine:PolicyAuditWorkflow-prod")
    monkeypatch.setenv("AWS_AVP_ENABLED", "true")
    monkeypatch.setenv("AWS_DYNAMODB_ENABLED", "true")
    monkeypatch.setenv("AWS_S3_ENABLED", "true")

    # Mock has_aws_credentials to True for config validation testing
    monkeypatch.setattr(AWSConfig, "has_aws_credentials", lambda self: True)

    config = AWSConfig()
    assert config.environment == "prod"
    assert config.avp_policy_store_id == "ps-acmepay-prod"
    assert config.state_machine_arn == "arn:aws:states:us-east-1:123456789012:stateMachine:PolicyAuditWorkflow-prod"

    # Should not raise AWSConfigurationError
    config.validate_configuration()


def test_aws_config_missing_avp_store_id_in_strict_mode_fails(monkeypatch):
    """Verifies that missing AVP_POLICY_STORE_ID raises an error in strict mode when AVP is enabled."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("STRICT_AWS", "true")
    monkeypatch.setenv("AWS_AVP_ENABLED", "true")
    monkeypatch.delenv("AVP_POLICY_STORE_ID", raising=False)
    monkeypatch.setattr(AWSConfig, "has_aws_credentials", lambda self: True)

    config = AWSConfig()
    config.avp_policy_store_id = ""
    with pytest.raises(AWSConfigurationError, match="AVP_POLICY_STORE_ID must be configured"):
        config.validate_configuration()


def test_sam_template_security_and_packaging_invariants():
    """Inspects template.yaml text to verify security boundaries and packaging directives."""
    repo_root = Path(__file__).resolve().parents[2]
    template_path = repo_root / "infrastructure" / "template.yaml"
    assert template_path.exists(), "infrastructure/template.yaml must exist"

    content = template_path.read_text(encoding="utf-8")

    # Verify backend CodeUri and explicit parent packaging
    assert "CodeUri: ../backend" in content
    assert "ParentPackageMode: explicit" in content
    assert "ParentPackages: backend" in content

    # Verify CORS does not use hardcoded wildcard '*'
    assert "AllowOrigins:\n          - '*'" not in content
    assert "FrontendOrigin" in content

    # Verify Verified Permissions IAM policy is scoped and does not use broad wildcard Resource: '*'
    assert "verifiedpermissions:GetPolicyStore" in content
    assert "policy-store/${AVPPolicyStoreId}" in content
    assert "Resource: '*'" not in content, "Wildcard Resource: '*' must not be used for Verified Permissions"

    # Verify Bedrock model IDs include both Claude 3.5 Sonnet foundation models
    assert "anthropic.claude-3-5-sonnet-20240620-v1:0" in content
    assert "anthropic.claude-3-5-sonnet-20241022-v2:0" in content
