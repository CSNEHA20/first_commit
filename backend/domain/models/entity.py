"""
PolicyLab Entity Provider Domain Models & Contracts
Defines formal interfaces, bounded snapshots, and fixture loaders for Cedar authorization entity graphs.
Fulfills Stage A requirements: reliable, deterministic entity loading with explicit error handling.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field


def parse_entity_uid_str(uid_str: str) -> Dict[str, str]:
    """
    Parses a Cedar entity UID string like 'User::"alice"' into {'type': 'User', 'id': 'alice'}.
    """
    if not uid_str:
        raise ValueError("Entity UID string cannot be empty.")
    match = re.match(r'^([A-Za-z0-9_:]+?)::"?([^"]+)"?$', uid_str.strip())
    if match:
        return {"type": match.group(1), "id": match.group(2)}
    raise ValueError(f"Invalid Cedar entity UID format: '{uid_str}'. Expected format: 'Type::\"id\"'")


def format_entity_uid(uid: Any) -> str:
    """
    Formats an entity UID dictionary or string into canonical 'Type::\"id\"'.
    """
    if isinstance(uid, str):
        parsed = parse_entity_uid_str(uid)
        return f'{parsed["type"]}::"{parsed["id"]}"'
    if isinstance(uid, dict) and "type" in uid and "id" in uid:
        return f'{uid["type"]}::"{uid["id"]}"'
    raise ValueError(f"Cannot format entity UID from: {uid}")


def compute_canonical_entity_hash(entities: List[Dict[str, Any]]) -> str:
    """
    Computes a deterministic SHA-256 integrity hash over a list of entity dictionaries.
    Sorts entities by canonical UID string to guarantee stability.
    """
    sorted_entities = sorted(
        entities,
        key=lambda e: format_entity_uid(e.get("uid", {"type": "", "id": ""}))
    )
    serialized = json.dumps(sorted_entities, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class EntityRetrievalStatus(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    NOT_FOUND = "NOT_FOUND"
    ERROR = "ERROR"


class EntityProviderResult(BaseModel):
    """Result payload from an entity provider query."""
    status: EntityRetrievalStatus
    providerId: str
    snapshotId: Optional[str] = None
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    requestedUids: List[str] = Field(default_factory=list)
    missingUids: List[str] = Field(default_factory=list)
    diagnostics: List[str] = Field(default_factory=list)
    freshnessTimestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EntitySnapshot(BaseModel):
    """
    Immutable, bounded entity snapshot used to ensure consistent before-and-after
    policy comparison without mutable data drift.
    """
    snapshotId: str
    providerId: str
    entityUids: List[str] = Field(default_factory=list)
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    contentHash: str
    schemaVersion: Optional[str] = None
    scope: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def verify_integrity(self) -> bool:
        """Verifies that the content hash matches the stored entities."""
        return self.contentHash == compute_canonical_entity_hash(self.entities)


class IEntityProvider(ABC):
    """
    Formal interface for retrieving Cedar entity graphs and bounded snapshots.
    Guarantees isolation of database/storage details from Cedar authorization evaluation.
    """

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier of the entity provider."""
        pass

    @abstractmethod
    def get_entity(self, entity_uid: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single entity by its canonical UID string."""
        pass

    @abstractmethod
    def load_entities(self, entity_uids: List[str]) -> EntityProviderResult:
        """
        Retrieves multiple entities by UID. Explicitly populates missingUids
        for entities not found.
        """
        pass

    @abstractmethod
    def load_snapshot(self, snapshot_id: str) -> EntitySnapshot:
        """Retrieves an existing bounded entity snapshot by ID."""
        pass

    @abstractmethod
    def create_snapshot(
        self,
        entity_scope: Optional[Dict[str, Any]] = None,
        snapshot_id: Optional[str] = None,
        schema_version: Optional[str] = None,
    ) -> EntitySnapshot:
        """Creates an immutable, bounded entity snapshot."""
        pass

    @abstractmethod
    def get_snapshot_metadata(self, snapshot_id: str) -> Dict[str, Any]:
        """Retrieves metadata and integrity status for a snapshot."""
        pass

    @abstractmethod
    def get_entities(self) -> List[Dict[str, Any]]:
        """Returns all available entity records for backward compatibility."""
        pass


class FixtureEntityProvider(IEntityProvider):
    """
    Loads deterministic entity graph fixtures from JSON files or in-memory dictionaries.
    Guarantees 100% offline reproducibility without external AWS or database dependencies.
    """

    def __init__(
        self,
        entities: Optional[List[Dict[str, Any]]] = None,
        fixture_path: Optional[str] = None,
        provider_id: str = "fixture:acmepay",
    ):
        self._provider_id = provider_id
        self._entities_by_uid: Dict[str, Dict[str, Any]] = {}
        self._snapshots: Dict[str, EntitySnapshot] = {}
        self._request_cache: Dict[str, Dict[str, Any]] = {}

        raw_entities: List[Dict[str, Any]] = []
        if entities is not None:
            raw_entities = entities
        elif fixture_path:
            path = Path(fixture_path)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    raw_entities = json.load(f)
            else:
                raise FileNotFoundError(f"Fixture path not found: {fixture_path}")
        else:
            # Default to AcmePay fixtures/entities.json if present
            default_path = Path(__file__).resolve().parent.parent.parent.parent / "fixtures" / "entities.json"
            if default_path.exists():
                with open(default_path, "r", encoding="utf-8") as f:
                    raw_entities = json.load(f)

        self._load_and_validate_raw_entities(raw_entities)

        # Create default snapshot for the initial dataset
        self.create_snapshot(
            entity_scope={"scope": "all_fixtures"},
            snapshot_id="snapshot_default_acmepay",
        )

    @property
    def provider_id(self) -> str:
        return self._provider_id

    def _load_and_validate_raw_entities(self, raw_entities: List[Dict[str, Any]]) -> None:
        """Validates structure and normalizes raw entity records."""
        for item in raw_entities:
            if not isinstance(item, dict):
                raise ValueError(f"Malformed entity record (must be dict): {item}")
            if "uid" not in item:
                raise ValueError(f"Entity missing required 'uid' field: {item}")
            
            uid_str = format_entity_uid(item["uid"])
            attrs = item.get("attrs", {})
            if not isinstance(attrs, dict):
                raise ValueError(f"Entity '{uid_str}' attrs must be a dictionary.")
            
            parents = item.get("parents", [])
            if not isinstance(parents, list):
                raise ValueError(f"Entity '{uid_str}' parents must be a list.")
            
            # Canonicalize parents
            canonical_parents = []
            for p in parents:
                canonical_parents.append(parse_entity_uid_str(format_entity_uid(p)))

            canonical_entity = {
                "uid": parse_entity_uid_str(uid_str),
                "attrs": attrs,
                "parents": canonical_parents,
            }
            self._entities_by_uid[uid_str] = canonical_entity

    def get_entity(self, entity_uid: str) -> Optional[Dict[str, Any]]:
        canonical_uid = format_entity_uid(entity_uid)
        if canonical_uid in self._request_cache:
            return self._request_cache[canonical_uid]
        entity = self._entities_by_uid.get(canonical_uid)
        if entity:
            self._request_cache[canonical_uid] = entity
        return entity

    def load_entities(self, entity_uids: List[str]) -> EntityProviderResult:
        found_entities: List[Dict[str, Any]] = []
        missing_uids: List[str] = []

        for uid in entity_uids:
            try:
                canonical_uid = format_entity_uid(uid)
                entity = self.get_entity(canonical_uid)
                if entity:
                    found_entities.append(entity)
                else:
                    missing_uids.append(canonical_uid)
            except ValueError as ve:
                missing_uids.append(str(uid))

        if not missing_uids:
            status = EntityRetrievalStatus.SUCCESS
        elif found_entities:
            status = EntityRetrievalStatus.PARTIAL
        else:
            status = EntityRetrievalStatus.NOT_FOUND

        return EntityProviderResult(
            status=status,
            providerId=self.provider_id,
            entities=found_entities,
            requestedUids=[format_entity_uid(u) if isinstance(u, str) and "::" in u else str(u) for u in entity_uids],
            missingUids=missing_uids,
            diagnostics=[f"Missing {len(missing_uids)} requested entities"] if missing_uids else [],
        )

    def load_snapshot(self, snapshot_id: str) -> EntitySnapshot:
        snapshot = self._snapshots.get(snapshot_id)
        if not snapshot:
            raise KeyError(f"Entity snapshot '{snapshot_id}' does not exist.")
        if not snapshot.verify_integrity():
            raise ValueError(f"Entity snapshot '{snapshot_id}' failed SHA-256 integrity verification.")
        return snapshot

    def create_snapshot(
        self,
        entity_scope: Optional[Dict[str, Any]] = None,
        snapshot_id: Optional[str] = None,
        schema_version: Optional[str] = None,
    ) -> EntitySnapshot:
        sid = snapshot_id or f"snap_{hashlib.sha256(str(datetime.now().timestamp()).encode()).hexdigest()[:12]}"
        
        # Determine subset or full set based on scope
        if entity_scope and "uids" in entity_scope:
            target_uids = [format_entity_uid(u) for u in entity_scope["uids"]]
            entities = [self._entities_by_uid[u] for u in target_uids if u in self._entities_by_uid]
        else:
            entities = list(self._entities_by_uid.values())

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
            metadata={"total_entities": len(entities)},
        )
        self._snapshots[sid] = snapshot
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
        return list(self._entities_by_uid.values())

    def clear_request_cache(self) -> None:
        """Clears request-scoped cache."""
        self._request_cache.clear()
