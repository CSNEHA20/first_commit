"""Unit tests for Connected Workspace API endpoints and repository persistence."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app, repository


@pytest.fixture
def client():
    return TestClient(app)


def test_workspace_crud_lifecycle(client):
    # 1. Create a workspace
    create_payload = {
        "name": "Acme Microservices Cedar",
        "description": "Custom customer tenant policy set",
        "mode": "connected",
        "baselinePolicyText": "permit(principal, action, resource);",
        "candidatePolicyText": "permit(principal == User::\"alice\", action, resource);",
        "schemaText": "{}",
        "entitiesJson": "[]",
        "scenarios": [
            {
                "id": "sc-01",
                "name": "Alice View",
                "principal": "User::\"alice\"",
                "action": "Action::\"view\"",
                "resource": "Document::\"doc-1\"",
                "expectedDecision": "ALLOW"
            }
        ]
    }
    create_res = client.post("/workspaces", json=create_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    workspace_id = created_data["workspaceId"]
    assert created_data["name"] == "Acme Microservices Cedar"
    assert created_data["scope"] == "LOCAL_SESSION"

    # 2. Get the workspace
    get_res = client.get(f"/workspaces/{workspace_id}")
    assert get_res.status_code == 200
    fetched_data = get_res.json()
    assert fetched_data["workspaceId"] == workspace_id
    assert fetched_data["name"] == "Acme Microservices Cedar"

    # 3. List workspaces
    list_res = client.get("/workspaces")
    assert list_res.status_code == 200
    workspaces = list_res.json()
    assert any(w["workspaceId"] == workspace_id for w in workspaces)


def test_workspace_not_found(client):
    res = client.get("/workspaces/ws-nonexistent-999")
    assert res.status_code == 404
