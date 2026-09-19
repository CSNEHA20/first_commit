"""
PolicyLab Stored Entity Provider
Implements the IEntityProvider contract backed by a persistent repository.
Isolates database queries and entity normalization from Cedar authorization engine.
"""

from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional

from ..models.entity import (
    EntityProviderResult,
    EntityRetrievalStatus,
    EntitySnapshot,
    IEntityProvider,
    compute_canonical_entity_hash,
    format_entity_uid,
    parse_entity_uid_str,
)
from .repository import IPolicyLabRepository, InMemoryPolicyLabRepository


class StoredEntityProvider(IEntityProvider):
    """
    Entity provider that retrieves and normalizes entities from the persistence repository.
    Ensures zero SQL/NoSQL query logic leaks into Cedar evaluation modules.
    """

    def __init__(
        self,
        repository: Optional[IPolicyLabRepository] = None,
        provider_id: str = "stored:dynamodb_or_memory",
        default_snapshot_id: Optional[str] = None,
    ):
        self._repository = repository or InMemoryPolicyLabRepository()
        self._provider_id = provider_id
        self._default_snapshot_id = default_snapshot_id
        self._request_cache: Dict[str, Dict[str, Any]] = {}

    @property
    def provider_id(self) -> str:
        return self._provider_id

    def get_entity(self, entity_uid: str) -> Optional[Dict[str, Any]]:
        canonical_uid = format_entity_uid(entity_uid)
        if canonical_uid in self._request_cache:
            return self._request_cache[canonical_uid]

        # Retrieve through snapshot if available
        if self._default_snapshot_id:
            snap = self._repository.get_snapshot(self._default_snapshot_id)
            if snap:
                for e in snap.entities:
                    if format_entity_uid(e["uid"]) == canonical_uid:
                        self._request_cache[canonical_uid] = e
                        return e

        return None

    def load_entities(self, entity_uids: List[str]) -> EntityProviderResult:
        found: List[Dict[str, Any]] = []
        missing: List[str] = []

        for uid in entity_uids:
            canonical = format_entity_uid(uid)
            ent = self.get_entity(canonical)
            if ent:
                found.append(ent)
            else:
                missing.append(canonical)

        status = (
            EntityRetrievalStatus.SUCCESS
            if not missing
            else (EntityRetrievalStatus.PARTIAL if found else EntityRetrievalStatus.NOT_FOUND)
        )

        return EntityProviderResult(
            status=status,
            providerId=self.provider_id,
            snapshotId=self._default_snapshot_id,
            entities=found,
            requestedUids=[format_entity_uid(u) for u in entity_uids],
            missingUids=missing,
            diagnostics=[f"Could not find entity {m} in stored repository" for m in missing],
        )

    def load_snapshot(self, snapshot_id: str) -> EntitySnapshot:
        snap = self._repository.get_snapshot(snapshot_id)
        if not snap:
            raise KeyError(f"Stored entity snapshot '{snapshot_id}' not found.")
        if not snap.verify_integrity():
            raise ValueError(f"Stored snapshot '{snapshot_id}' failed SHA-256 integrity verification.")
        return snap

    def create_snapshot(
        self,
        entity_scope: Optional[Dict[str, Any]] = None,
        snapshot_id: Optional[str] = None,
        schema_version: Optional[str] = None,
    ) -> EntitySnapshot:
        sid = snapshot_id or f"snap_stored_{hashlib.sha256(str(datetime.now().timestamp()).encode()).hexdigest()[:12]}"
        
        entities: List[Dict[str, Any]] = []
        if entity_scope and "entities" in entity_scope:
            entities = entity_scope["entities"]
        elif self._default_snapshot_id:
            existing = self._repository.get_snapshot(self._default_snapshot_id)
            if existing:
                entities = existing.entities

        content_hash = compute_canonical_entity_hash(entities)
        snapshot = EntitySnapshot(
            snapshotId=sid,
            providerId=self.provider_id,
            entityUids=[format_entity_uid(e["uid"]) for e in entities],
            entities=entities,
            createdAt=datetime.now(timezone.utc).isoformat(),
            contentHash=content_hash,
            schemaVersion=schema_version,
            scope=entity_scope or {},
            metadata={"source": "stored_repository", "count": len(entities)},
        )
        self._repository.save_snapshot(snapshot)
        self._default_snapshot_id = sid
        return snapshot

    def get_snapshot_metadata(self, snapshot_id: str) -> Dict[str, Any]:
        snapshot = self.load_snapshot(snapshot_id)
        return {
            "snapshotId": snapshot.snapshotId,
            "providerId": snapshot.providerId,
            "createdAt": snapshot.createdAt,
            "contentHash": snapshot.contentHash,
            "entityCount": len(snapshot.entities),
            "integrityVerified": snapshot.verify_integrity(),
            "schemaVersion": snapshot.schemaVersion,
            "scope": snapshot.scope,
        }

    def get_entities(self) -> List[Dict[str, Any]]:
        if self._default_snapshot_id:
            snap = self._repository.get_snapshot(self._default_snapshot_id)
            if snap:
                return snap.entities
        return []
