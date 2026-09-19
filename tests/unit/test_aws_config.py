"""
Unit tests for AWS Configuration and Environment Auditing (Phase 8 Stage B)
"""

import os
import pytest
from backend.core.aws_config import (
    AWSConfig,
    AWSConfigurationError,
    OperationalStatus,
)


def test_aws_config_dev_mode_defaults():
    """Verifies that in dev mode, absence of AWS credentials falls back cleanly."""
    orig_env = os.environ.get("ENVIRONMENT")
    orig_strict = os.environ.get("STRICT_AWS")
    try:
        os.environ["ENVIRONMENT"] = "dev"
        os.environ["STRICT_AWS"] = "false"
        config = AWSConfig()
        # validate_configuration should NOT raise in dev mode
        config.validate_configuration()

        audit = config.audit_environment()
        assert audit.environment == "dev"
        assert audit.strictMode is False
        assert "verified_permissions" in audit.services
        assert audit.services["verified_permissions"].status in (
            OperationalStatus.LOCAL_MOCKED,
            OperationalStatus.NOT_CONFIGURED,
        )
    finally:
        if orig_env is not None:
            os.environ["ENVIRONMENT"] = orig_env
        else:
            os.environ.pop("ENVIRONMENT", None)
        if orig_strict is not None:
            os.environ["STRICT_AWS"] = orig_strict
        else:
            os.environ.pop("STRICT_AWS", None)


def test_aws_config_strict_mode_raises_on_missing_credentials(monkeypatch):
    """Verifies that in strict mode without credentials, validate_configuration raises AWSConfigurationError."""
    monkeypatch.setenv("STRICT_AWS", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    config = AWSConfig()
    # Mock has_aws_credentials to return False
    monkeypatch.setattr(config, "has_aws_credentials", lambda: False)

    with pytest.raises(AWSConfigurationError) as exc:
        config.validate_configuration()
    assert "AWS credentials are required" in str(exc.value)


def test_aws_config_strict_mode_raises_on_missing_service_tables(monkeypatch):
    """Verifies that when services are enabled in strict mode, missing table/bucket names fail closed."""
    monkeypatch.setenv("STRICT_AWS", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AWS_DYNAMODB_ENABLED", "true")
    monkeypatch.delenv("POLICYLAB_DYNAMODB_TABLE", raising=False)

    config = AWSConfig()
    monkeypatch.setattr(config, "has_aws_credentials", lambda: True)

    with pytest.raises(AWSConfigurationError) as exc:
        config.validate_configuration()
    assert "POLICYLAB_DYNAMODB_TABLE must be configured" in str(exc.value)


def test_audit_environment_reflects_truthful_service_state(monkeypatch):
    """Verifies that audit_environment accurately flags services as LOCAL_MOCKED when credentials are absent."""
    config = AWSConfig()
    monkeypatch.setattr(config, "has_aws_credentials", lambda: False)

    audit = config.audit_environment()
    assert audit.credentialsAvailable is False
    assert audit.services["bedrock"].status == OperationalStatus.LOCAL_MOCKED
    assert audit.services["dynamodb"].status == OperationalStatus.LOCAL_MOCKED
    assert audit.services["s3"].status == OperationalStatus.LOCAL_MOCKED
    assert audit.services["verified_permissions"].status == OperationalStatus.LOCAL_MOCKED
