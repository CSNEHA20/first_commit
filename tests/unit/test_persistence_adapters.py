"""
Unit tests for PolicyLab Stored Data and Database Adapters (Stage B).
"""

import pytest
from backend.domain.persistence import (
    InMemoryPolicyLabRepository,
    StoredEntityProvider,
    DynamoDBPolicyLabRepository,
    S3ArtifactRepository,
    DynamoDBEntityProvider,
)
from backend.domain.models.entity import (
    EntityRetrievalStatus,
    EntitySnapshot,
    FixtureEntityProvider,
)
from backend.domain.models.deployment import DeploymentRecord, DeploymentStatus


def test_in_memory_repository_policyset_and_versions():
    repo = InMemoryPolicyLabRepository()

    # Verify seeded records
    p_set = repo.get_policy_set("ps-acmepay-prod")
    assert p_set is not None
    assert p_set["name"] == "AcmePay Core Authorization"

    versions = repo.list_policy_versions("ps-acmepay-prod")
    assert len(versions) >= 2
    v12 = repo.get_policy_version("ps-acmepay-prod", "v12")
    assert v12 is not None
    assert v12["author"] == "Sneha"

    # Add a new version
    repo.save_policy_version({
        "setId": "ps-acmepay-prod",
        "versionTag": "v14",
        "author": "Sneha",
        "policyHash": "hash14",
        "changeSummary": "Fixed contractor permissions",
        "gateStatus": "PASS",
    })
    v14 = repo.get_policy_version("ps-acmepay-prod", "v14")
    assert v14 is not None
    assert v14["gateStatus"] == "PASS"


def test_stored_entity_provider_with_snapshot():
    repo = InMemoryPolicyLabRepository()
    fixture = FixtureEntityProvider()
    snap = fixture.create_snapshot(snapshot_id="snap_stored_test")
    repo.save_snapshot(snap)

    provider = StoredEntityProvider(repository=repo, default_snapshot_id="snap_stored_test")
    
    # Retrieve existing entity
    admin_user = provider.get_entity('User::"admin_root"')
    assert admin_user is not None

    # Retrieve non-existing entity
    missing = provider.get_entity('User::"non_existent"')
    assert missing is None

    # Load entities batch
    res = provider.load_entities(['User::"admin_root"', 'User::"unknown"'])
    assert res.status == EntityRetrievalStatus.PARTIAL
    assert 'User::"unknown"' in res.missingUids
    assert len(res.entities) == 1

    # Snapshot loading
    loaded_snap = provider.load_snapshot("snap_stored_test")
    assert loaded_snap.snapshotId == "snap_stored_test"
    assert loaded_snap.verify_integrity() is True


def test_s3_artifact_repository_local_fallback():
    s3_repo = S3ArtifactRepository()
    res = s3_repo.store_artifact(
        key="policies/v12.cedar",
        content='permit(principal, action, resource);',
        content_type="text/plain",
    )
    assert res["sha256"] is not None
    assert res["uri"] is not None
    assert "local://" in res["uri"] or "s3://" in res["uri"]

    retrieved = s3_repo.get_artifact("policies/v12.cedar")
    assert retrieved == 'permit(principal, action, resource);'


def test_dynamodb_policy_lab_repository_fallback():
    dynamo_repo = DynamoDBPolicyLabRepository()
    # Offline fallback works deterministically
    p_set = dynamo_repo.get_policy_set("ps-acmepay-prod")
    assert p_set is not None

    dynamo_repo.save_policy_set({"id": "ps-test", "name": "Test Set"})
    retrieved = dynamo_repo.get_policy_set("ps-test")
    assert retrieved is not None
    assert retrieved["name"] == "Test Set"


def test_dynamodb_entity_provider_fallback():
    provider = DynamoDBEntityProvider()
    admin = provider.get_entity('User::"admin_root"')
    assert admin is not None
    assert admin["uid"]["id"] == "admin_root"

    res = provider.load_entities(['User::"editor_bob"'])
    assert res.status == EntityRetrievalStatus.SUCCESS
    assert len(res.entities) == 1
