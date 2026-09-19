"""
PolicyLab DynamoDB Entity Provider
Implements the IEntityProvider contract backed by AWS DynamoDB table.
Retrieves entity records by bounded key patterns and normalizes them into Cedar entity representations.
Gracefully falls back to deterministic fixture data when DynamoDB is offline or unconfigured.
"""

from datetime import datetime, timezone
import hashlib
import json
import os
from typing import Any, Dict, List, Optional

from ..models.entity import (
    EntityProviderResult,
    EntityRetrievalStatus,
    EntitySnapshot,
    FixtureEntityProvider,
    IEntityProvider,
    compute_canonical_entity_hash,
    format_entity_uid,
    parse_entity_uid_str,
)


class DynamoDBEntityProvider(IEntityProvider):
    """
    AWS DynamoDB entity provider for PolicyLab.
    Item schema in DynamoDB:
      PK: ENTITY#<type>
      SK: ID#<id>
      attrs: Map
      parents: List of Maps (or string UIDs)
    """

    def __init__(
        self,
        table_name: Optional[str] = None,
        region: Optional[str] = None,
        provider_id: str = "provider:dynamodb",
    ):
        self._provider_id = provider_id
        self.table_name = table_name or os.environ.get("POLICYLAB_ENTITY_TABLE", "PolicyLabEntities")
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._fallback_provider = FixtureEntityProvider(provider_id="provider:dynamodb:fallback_fixture")
        self._dynamodb_resource = None
        self._table = None
        self._initialize()

    def _initialize(self) -> None:
        try:
            import boto3
            self._dynamodb_resource = boto3.resource("dynamodb", region_name=self.region)
            self._table = self._dynamodb_resource.Table(self.table_name)
        except Exception:
            self._dynamodb_resource = None
            self._table = None

    @property
    def is_live(self) -> bool:
        return self._table is not None and os.environ.get("AWS_DYNAMODB_ENABLED") == "true"

    @property
    def provider_id(self) -> str:
        return self._provider_id

    def get_entity(self, entity_uid: str) -> Optional[Dict[str, Any]]:
        if self.is_live:
            try:
                parsed = parse_entity_uid_str(entity_uid)
                pk = f"ENTITY#{parsed['type']}"
                sk = f"ID#{parsed['id']}"
                res = self._table.get_item(Key={"PK": pk, "SK": sk})
                if "Item" in res:
                    item = res["Item"]
                    return {
                        "uid": parsed,
                        "attrs": item.get("attrs", {}),
                        "parents": item.get("parents", []),
                    }
                return None
            except Exception:
                pass
        return self._fallback_provider.get_entity(entity_uid)

    def load_entities(self, entity_uids: List[str]) -> EntityProviderResult:
        if self.is_live:
            found: List[Dict[str, Any]] = []
            missing: List[str] = []
            for uid in entity_uids:
                ent = self.get_entity(uid)
                if ent:
                    found.append(ent)
                else:
                    missing.append(format_entity_uid(uid))
            status = (
                EntityRetrievalStatus.SUCCESS
                if not missing
                else (EntityRetrievalStatus.PARTIAL if found else EntityRetrievalStatus.NOT_FOUND)
            )
            return EntityProviderResult(
                status=status,
                providerId=self.provider_id,
                entities=found,
                requestedUids=[format_entity_uid(u) for u in entity_uids],
                missingUids=missing,
                diagnostics=[f"DynamoDB missing entity: {m}" for m in missing],
            )
        return self._fallback_provider.load_entities(entity_uids)

    def load_snapshot(self, snapshot_id: str) -> EntitySnapshot:
        return self._fallback_provider.load_snapshot(snapshot_id)

    def create_snapshot(
        self,
        entity_scope: Optional[Dict[str, Any]] = None,
        snapshot_id: Optional[str] = None,
        schema_version: Optional[str] = None,
    ) -> EntitySnapshot:
        return self._fallback_provider.create_snapshot(entity_scope, snapshot_id, schema_version)

    def get_snapshot_metadata(self, snapshot_id: str) -> Dict[str, Any]:
        return self._fallback_provider.get_snapshot_metadata(snapshot_id)

    def get_entities(self) -> List[Dict[str, Any]]:
        return self._fallback_provider.get_entities()
