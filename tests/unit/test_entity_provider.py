"""
Unit tests for PolicyLab Entity Provider, Bounded Snapshots, and Failure Integrity (Stage A).
"""

import pytest
from backend.domain.models.entity import (
    EntityRetrievalStatus,
    EntitySnapshot,
    FixtureEntityProvider,
    format_entity_uid,
    parse_entity_uid_str,
    compute_canonical_entity_hash,
)


def test_parse_and_format_entity_uid():
    parsed = parse_entity_uid_str('User::"alice"')
    assert parsed == {"type": "User", "id": "alice"}

    formatted = format_entity_uid(parsed)
    assert formatted == 'User::"alice"'

    # Test without quotes
    parsed_no_quotes = parse_entity_uid_str("Action::view")
    assert parsed_no_quotes == {"type": "Action", "id": "view"}
    assert format_entity_uid(parsed_no_quotes) == 'Action::"view"'

    with pytest.raises(ValueError):
        parse_entity_uid_str("InvalidUidString")


def test_fixture_entity_provider_loads_acmepay():
    provider = FixtureEntityProvider()
    entities = provider.get_entities()
    assert len(entities) > 0

    # Test single retrieval
    admin_user = provider.get_entity('User::"admin_root"')
    assert admin_user is not None
    assert admin_user["uid"]["id"] == "admin_root"
    assert admin_user["parents"][0]["id"] == "admin"


def test_fixture_entity_provider_missing_entity():
    provider = FixtureEntityProvider()
    missing = provider.get_entity('User::"ghost_user"')
    assert missing is None

    result = provider.load_entities(['User::"editor_bob"', 'User::"ghost_user"'])
    assert result.status == EntityRetrievalStatus.PARTIAL
    assert len(result.entities) == 1
    assert 'User::"ghost_user"' in result.missingUids
    assert len(result.diagnostics) > 0


def test_fixture_entity_provider_snapshot_integrity():
    provider = FixtureEntityProvider()
    snapshot = provider.create_snapshot(
        entity_scope={"scope": "finance"},
        snapshot_id="snap_test_001",
        schema_version="1.0",
    )

    assert snapshot.snapshotId == "snap_test_001"
    assert snapshot.contentHash is not None
    assert snapshot.verify_integrity() is True

    # Retrieve snapshot and metadata
    retrieved = provider.load_snapshot("snap_test_001")
    assert retrieved.contentHash == snapshot.contentHash

    meta = provider.get_snapshot_metadata("snap_test_001")
    assert meta["integrityVerified"] is True
    assert meta["entityCount"] == len(snapshot.entities)

    # Corrupt snapshot to test integrity failure
    corrupted_snapshot = EntitySnapshot(
        snapshotId="corrupted",
        providerId="test",
        entities=[{"uid": {"type": "A", "id": "1"}, "attrs": {}, "parents": []}],
        contentHash="invalid_hash_value",
    )
    assert corrupted_snapshot.verify_integrity() is False


def test_fixture_entity_provider_malformed_rejection():
    malformed_data = [{"invalid": "no_uid"}]
    with pytest.raises(ValueError, match="missing required 'uid' field"):
        FixtureEntityProvider(entities=malformed_data)


def test_fixture_entity_provider_caching():
    provider = FixtureEntityProvider()
    e1 = provider.get_entity('User::"contractor_alice"')
    assert e1 is not None

    # Check that cache is populated
    assert 'User::"contractor_alice"' in provider._request_cache
    provider.clear_request_cache()
    assert len(provider._request_cache) == 0
