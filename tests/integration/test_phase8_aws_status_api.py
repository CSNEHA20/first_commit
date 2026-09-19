"""
Integration tests for Phase 8 AWS Status & Deployment Harmonization APIs
"""

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

POLICY_V12 = """
permit (
    principal in Role::"admin",
    action,
    resource
);
"""


def test_api_aws_status():
    """Verifies that GET /aws/status returns truthful status for all 5 AWS services."""
    response = client.get("/aws/status")
    assert response.status_code == 200
    data = response.json()
    assert "environment" in data
    assert "services" in data
    assert "verified_permissions" in data["services"]
    assert "bedrock" in data["services"]
    assert "dynamodb" in data["services"]
    assert "s3" in data["services"]
    assert "step_functions" in data["services"]
    assert data["services"]["verified_permissions"]["status"] in ("LOCAL_MOCKED", "NOT_CONFIGURED", "LIVE")


def test_api_health_includes_aws_status():
    """Verifies that GET /health includes Cedar and AWS environment details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "cedarVersion" in data
    assert "environment" in data
    assert "credentialsDetected" in data


def test_api_deployment_readiness_rich_model():
    """Verifies that GET /deployment/readiness returns rich model for frontend compatibility."""
    response = client.get("/deployment/readiness")
    assert response.status_code == 200
    data = response.json()
    assert "isConfigured" in data
    assert "isReadyForDeployment" in data
    assert "adapterMode" in data
    assert data["adapterMode"] in ("LIVE_BOTO3", "DETERMINISTIC_FAKE", "NOT_CONFIGURED")
    assert "checklist" in data
    assert len(data["checklist"]) > 0


def test_api_deployment_lifecycle_frontend_payload_shape():
    """
    Verifies that the deployment lifecycle endpoints seamlessly accept the exact payload
    structure emitted by frontend/src/features/deployment/DeploymentScreen.tsx:
    1. /deployment/prepare with { candidatePolicyText, targetEnv, regressionReport }
    2. /deployment/approve with { candidatePolicyHashSha256, targetEnv, approverName }
    3. /deployment/submit with { candidatePolicyText, targetEnv, approvalToken }
    """
    # 1. Run regression
    reg_res = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": POLICY_V12,
            "candidatePolicyText": POLICY_V12,
            "suite": {
                "id": "suite_test",
                "name": "Suite Test",
                "scenarios": [
                    {
                        "id": "scen_1",
                        "title": "Admin view",
                        "principal": 'Role::"admin"',
                        "action": 'Action::"view"',
                        "resource": 'Document::"doc1"',
                        "context": {},
                        "expectedDecision": "ALLOW",
                    }
                ],
            },
            "contracts": [],
        },
    )
    assert reg_res.status_code == 200
    reg_report = reg_res.json()

    # 2. Prepare deployment using frontend payload
    prep_res = client.post(
        "/deployment/prepare",
        json={
            "candidatePolicyText": POLICY_V12,
            "targetEnv": "production",
            "regressionReport": reg_report,
        },
    )
    assert prep_res.status_code == 200
    prep_data = prep_res.json()
    assert prep_data["isDeployable"] is True
    assert prep_data["targetEnv"] == "production"
    assert "candidatePolicyHashSha256" in prep_data
    assert "preparedDeploymentId" in prep_data

    # 3. Approve deployment using frontend payload
    appr_res = client.post(
        "/deployment/approve",
        json={
            "candidatePolicyHashSha256": prep_data["candidatePolicyHashSha256"],
            "targetEnv": "production",
            "approverName": "Sneha (Security Lead)",
            "ticketReference": "SEC-8821",
            "approvalNotes": "Approved baseline v12 validation.",
        },
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert "approvalToken" in appr_data
    assert appr_data["status"] == "APPROVED"
    assert appr_data["approvedBy"] == "Sneha (Security Lead)"

    # 4. Submit deployment using frontend payload
    sub_res = client.post(
        "/deployment/submit",
        json={
            "candidatePolicyText": POLICY_V12,
            "targetEnv": "production",
            "approvalToken": appr_data["approvalToken"],
            "regressionRunId": reg_report["runId"],
            "candidateLabel": "v12",
        },
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] == "SYNCHRONIZED"
    assert sub_data["deployedBy"] == "Sneha (Security Lead)"
    assert "verificationProof" in sub_data
