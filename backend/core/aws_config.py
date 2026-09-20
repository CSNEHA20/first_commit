"""
PolicyLab AWS Configuration & Environment Auditing (Phase 8)
Provides centralized configuration validation, credential inspection,
and service readiness reporting.
Ensures strict verification in production mode while supporting deterministic
local fakes and offline testing without AWS credentials.
"""

from enum import Enum
import os
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def _load_dotenv() -> None:
    """Loads environment variables from backend/.env or .env if present."""
    candidate_paths = [
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
    ]
    for p in candidate_paths:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            os.environ[k] = v
            except Exception:
                pass
            break


_load_dotenv()


class OperationalStatus(str, Enum):
    LIVE = "LIVE"
    LOCAL_MOCKED = "LOCAL_MOCKED"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    UNAVAILABLE = "UNAVAILABLE"
    FAILED = "FAILED"


class ServiceStatus(BaseModel):
    serviceName: str
    status: OperationalStatus
    isLive: bool
    details: str
    requiredConfig: List[str]
    missingConfig: List[str] = Field(default_factory=list)


class AWSClusterStatus(BaseModel):
    environment: str
    region: str
    credentialsAvailable: bool
    strictMode: bool
    services: Dict[str, ServiceStatus]
    summary: str


class AWSConfigurationError(Exception):
    """Raised when mandatory AWS configuration or credentials are missing in strict/prod mode."""
    pass


class AWSConfig:
    """
    Centralized configuration manager for PolicyLab AWS integrations.
    """

    def __init__(self):
        self.reload_config()

    def reload_config(self) -> None:
        """Reloads configuration values from the current environment."""
        _load_dotenv()
        self.environment: str = os.environ.get("ENVIRONMENT", "dev").lower()
        self.strict_mode: bool = os.environ.get("STRICT_AWS", "false").lower() in ("true", "1")
        self.region: str = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"

        # Service Resource Identifiers
        self.dynamodb_table: str = os.environ.get("POLICYLAB_DYNAMODB_TABLE", "PolicyLab-dev")
        self.artifact_bucket: str = os.environ.get(
            "POLICYLAB_ARTIFACT_BUCKET", "policylab-artifacts-dev"
        )
        self.avp_policy_store_id: str = os.environ.get(
            "AVP_POLICY_STORE_ID", "ps-acmepay-prod"
        )
        self.bedrock_model_id: str = os.environ.get(
            "BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"
        )
        self.state_machine_arn: Optional[str] = os.environ.get("AUDIT_STATE_MACHINE_ARN")

        # Service feature flags
        self.avp_enabled: bool = os.environ.get("AWS_AVP_ENABLED", "false").lower() in ("true", "1")
        self.bedrock_enabled: bool = os.environ.get("AWS_BEDROCK_ENABLED", "false").lower() in ("true", "1")
        self.dynamodb_enabled: bool = os.environ.get("AWS_DYNAMODB_ENABLED", "false").lower() in ("true", "1")
        self.s3_enabled: bool = os.environ.get("AWS_S3_ENABLED", "false").lower() in ("true", "1")

    def has_aws_credentials(self) -> bool:
        """Inspects whether active AWS credentials are discoverable by environment or boto3."""
        _load_dotenv()
        if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
            return True
        try:
            import boto3
            session = boto3.Session(region_name=self.region)
            creds = session.get_credentials()
            return creds is not None and creds.access_key is not None
        except Exception:
            return False

    def validate_configuration(self) -> None:
        """
        Validates environment configuration.
        In strict mode or production, enforces presence of credentials and service configurations.
        """
        if self.strict_mode or self.environment == "prod":
            if not self.has_aws_credentials():
                raise AWSConfigurationError(
                    f"AWS credentials are required in '{self.environment}' / strict mode, but none were detected."
                )
            if self.avp_enabled and not os.environ.get("AVP_POLICY_STORE_ID"):
                raise AWSConfigurationError("AVP_POLICY_STORE_ID must be configured when AWS_AVP_ENABLED=true.")
            if self.dynamodb_enabled and not os.environ.get("POLICYLAB_DYNAMODB_TABLE"):
                raise AWSConfigurationError("POLICYLAB_DYNAMODB_TABLE must be configured when AWS_DYNAMODB_ENABLED=true.")
            if self.s3_enabled and not os.environ.get("POLICYLAB_ARTIFACT_BUCKET"):
                raise AWSConfigurationError("POLICYLAB_ARTIFACT_BUCKET must be configured when AWS_S3_ENABLED=true.")

    def audit_environment(self) -> AWSClusterStatus:
        """
        Audits all PolicyLab AWS integration touchpoints and reports their truthful status.
        Never fabricates live status when credentials or resources are missing.
        """
        self.reload_config()
        creds_ok = self.has_aws_credentials()
        services: Dict[str, ServiceStatus] = {}

        # 1. Amazon Verified Permissions (AVP)
        avp_reqs = ["AWS_REGION", "AVP_POLICY_STORE_ID", "AWS_ACCESS_KEY_ID"]
        avp_missing = [k for k in ["AVP_POLICY_STORE_ID"] if not os.environ.get(k)]
        if not creds_ok or not self.avp_enabled:
            avp_status = OperationalStatus.LOCAL_MOCKED if not self.strict_mode else OperationalStatus.NOT_CONFIGURED
            avp_details = (
                "Local deterministic AVP simulation adapter active (No AWS credentials configured)."
                if not creds_ok
                else "Local deterministic AVP simulation adapter active (AWS_AVP_ENABLED is false)."
            )
        elif self.avp_enabled and not avp_missing:
            try:
                import boto3
                avp_client = boto3.client("verifiedpermissions", region_name=self.region)
                avp_client.get_policy_store(policyStoreId=self.avp_policy_store_id)
                avp_status = OperationalStatus.LIVE
                avp_details = f"Live AVP client ready targeting store '{self.avp_policy_store_id}' in '{self.region}'."
            except Exception as e:
                avp_status = OperationalStatus.UNAVAILABLE
                avp_details = f"Live AVP connection blocked: {str(e)}"
        else:
            avp_status = OperationalStatus.NOT_CONFIGURED
            avp_details = "AWS credentials present but AVP policy store ID is missing."
        services["verified_permissions"] = ServiceStatus(
            serviceName="Amazon Verified Permissions",
            status=avp_status,
            isLive=(avp_status == OperationalStatus.LIVE),
            details=avp_details,
            requiredConfig=avp_reqs,
            missingConfig=avp_missing,
        )

        # 2. Amazon Bedrock
        bedrock_reqs = ["AWS_REGION", "BEDROCK_MODEL_ID", "AWS_ACCESS_KEY_ID"]
        bedrock_missing = [k for k in ["BEDROCK_MODEL_ID"] if not os.environ.get(k)]
        if not creds_ok or not self.bedrock_enabled:
            bedrock_status = OperationalStatus.LOCAL_MOCKED if not self.strict_mode else OperationalStatus.NOT_CONFIGURED
            bedrock_details = (
                "Deterministic template generator and grounded fallback active (No AWS credentials)."
                if not creds_ok
                else "Deterministic template generator and grounded fallback active (AWS_BEDROCK_ENABLED is false)."
            )
        elif self.bedrock_enabled:
            try:
                import boto3
                bedrock_client = boto3.client("bedrock", region_name=self.region)
                bedrock_client.list_foundation_models(byProvider="Anthropic")
                bedrock_status = OperationalStatus.LIVE
                bedrock_details = f"Bedrock client confirmed with model '{self.bedrock_model_id}'."
            except Exception as e:
                bedrock_status = OperationalStatus.UNAVAILABLE
                bedrock_details = f"Bedrock live connection blocked: {str(e)}"
        else:
            bedrock_status = OperationalStatus.NOT_CONFIGURED
            bedrock_details = "AWS credentials present but AWS_BEDROCK_ENABLED is false."
        services["bedrock"] = ServiceStatus(
            serviceName="Amazon Bedrock",
            status=bedrock_status,
            isLive=(bedrock_status == OperationalStatus.LIVE),
            details=bedrock_details,
            requiredConfig=bedrock_reqs,
            missingConfig=bedrock_missing,
        )

        # 3. Amazon DynamoDB
        ddb_reqs = ["POLICYLAB_DYNAMODB_TABLE", "AWS_REGION", "AWS_ACCESS_KEY_ID"]
        ddb_missing = [k for k in ["POLICYLAB_DYNAMODB_TABLE"] if not os.environ.get(k)]
        if not creds_ok or not self.dynamodb_enabled:
            ddb_status = OperationalStatus.LOCAL_MOCKED if not self.strict_mode else OperationalStatus.NOT_CONFIGURED
            ddb_details = (
                "In-memory repository active for local development/testing."
                if not creds_ok
                else "In-memory repository active for local development/testing (AWS_DYNAMODB_ENABLED is false)."
            )
        elif self.dynamodb_enabled and not ddb_missing:
            try:
                import boto3
                ddb_client = boto3.client("dynamodb", region_name=self.region)
                ddb_client.describe_table(TableName=self.dynamodb_table)
                ddb_status = OperationalStatus.LIVE
                ddb_details = f"Connected to DynamoDB table '{self.dynamodb_table}'."
            except Exception as e:
                ddb_status = OperationalStatus.UNAVAILABLE
                ddb_details = f"DynamoDB live table blocked: {str(e)}"
        else:
            ddb_status = OperationalStatus.NOT_CONFIGURED
            ddb_details = "AWS credentials present but DynamoDB disabled or table unconfigured."
        services["dynamodb"] = ServiceStatus(
            serviceName="Amazon DynamoDB",
            status=ddb_status,
            isLive=(ddb_status == OperationalStatus.LIVE),
            details=ddb_details,
            requiredConfig=ddb_reqs,
            missingConfig=ddb_missing,
        )

        # 4. Amazon S3 Artifacts
        s3_reqs = ["POLICYLAB_ARTIFACT_BUCKET", "AWS_REGION", "AWS_ACCESS_KEY_ID"]
        s3_missing = [k for k in ["POLICYLAB_ARTIFACT_BUCKET"] if not os.environ.get(k)]
        if not creds_ok or not self.s3_enabled:
            s3_status = OperationalStatus.LOCAL_MOCKED if not self.strict_mode else OperationalStatus.NOT_CONFIGURED
            s3_details = (
                "Local in-memory & disk storage active for Cedar artifacts."
                if not creds_ok
                else "Local in-memory & disk storage active for Cedar artifacts (AWS_S3_ENABLED is false)."
            )
        elif self.s3_enabled and not s3_missing:
            try:
                import boto3
                s3_client = boto3.client("s3", region_name=self.region)
                s3_client.head_bucket(Bucket=self.artifact_bucket)
                s3_status = OperationalStatus.LIVE
                s3_details = f"S3 artifact repository targeting bucket '{self.artifact_bucket}'."
            except Exception as e:
                s3_status = OperationalStatus.UNAVAILABLE
                s3_details = f"S3 bucket blocked: {str(e)}"
        else:
            s3_status = OperationalStatus.NOT_CONFIGURED
            s3_details = "AWS credentials present but S3 disabled or bucket unconfigured."
        services["s3"] = ServiceStatus(
            serviceName="Amazon S3",
            status=s3_status,
            isLive=(s3_status == OperationalStatus.LIVE),
            details=s3_details,
            requiredConfig=s3_reqs,
            missingConfig=s3_missing,
        )

        # 5. AWS Step Functions
        sfn_status = OperationalStatus.NOT_CONFIGURED if not self.state_machine_arn else (
            OperationalStatus.LIVE if creds_ok else OperationalStatus.LOCAL_MOCKED
        )
        if self.state_machine_arn and creds_ok:
            try:
                import boto3
                sfn_client = boto3.client("stepfunctions", region_name=self.region)
                sfn_client.describe_state_machine(stateMachineArn=self.state_machine_arn)
                sfn_status = OperationalStatus.LIVE
                sfn_details = f"State machine ARN '{self.state_machine_arn}' confirmed."
            except Exception as e:
                sfn_status = OperationalStatus.UNAVAILABLE
                sfn_details = f"State machine ARN '{self.state_machine_arn}' registered, but access blocked: {str(e)}"
        else:
            sfn_details = (
                f"State machine ARN '{self.state_machine_arn}' registered."
                if self.state_machine_arn
                else "ASL workflow defined in infrastructure/statemachines/audit_workflow.asl.json; not deployed."
            )
        services["step_functions"] = ServiceStatus(
            serviceName="AWS Step Functions",
            status=sfn_status,
            isLive=(sfn_status == OperationalStatus.LIVE),
            details=sfn_details,
            requiredConfig=["AUDIT_STATE_MACHINE_ARN", "AWS_REGION", "AWS_ACCESS_KEY_ID"],
            missingConfig=["AUDIT_STATE_MACHINE_ARN"] if not self.state_machine_arn else [],
        )

        live_count = sum(1 for s in services.values() if s.isLive)
        summary = (
            f"Environment '{self.environment}' (Region: {self.region}). "
            f"Credentials detected: {creds_ok}. Live services: {live_count}/5."
        )

        return AWSClusterStatus(
            environment=self.environment,
            region=self.region,
            credentialsAvailable=creds_ok,
            strictMode=self.strict_mode,
            services=services,
            summary=summary,
        )


aws_config = AWSConfig()
