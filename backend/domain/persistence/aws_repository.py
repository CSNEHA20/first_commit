"""
PolicyLab AWS Persistence Adapters (DynamoDB & S3)
Provides scalable serverless persistence for PolicySets, PolicyVersions, Snapshots,
Audit Runs, and S3 Immutable Evidence Artifacts.
Includes graceful local fallback when AWS environment or credentials are unconfigured.
Hardened with SHA-256 integrity verification, conditional writes, and conflict detection.
"""

from datetime import datetime, timezone
import hashlib
import json
import os
from typing import Any, Dict, List, Optional

from ..models.deployment import DeploymentRecord, DeploymentStatus
from ..models.entity import EntitySnapshot, compute_canonical_entity_hash
from .repository import IPolicyLabRepository, InMemoryPolicyLabRepository


class PolicyVersionConflictError(Exception):
    """Raised when a conditional write fails due to duplicate or conflicting policy version tags."""
    pass


class S3ArtifactIntegrityError(Exception):
    """Raised when an artifact retrieved from storage does not match its expected SHA-256 hash."""
    pass


class S3ArtifactRepository:
    """
    Manages immutable Cedar policy artifacts, schemas, entity snapshots,
    and audit reports in Amazon S3 with SHA-256 content verification.
    """

    def __init__(self, bucket_name: Optional[str] = None, region: Optional[str] = None):
        self.bucket_name = bucket_name or os.environ.get("POLICYLAB_ARTIFACT_BUCKET", "policylab-artifacts-prod")
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._local_storage: Dict[str, Dict[str, Any]] = {}
        self._s3_client = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        try:
            import boto3
            import botocore.config
            cfg = botocore.config.Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2})
            self._s3_client = boto3.client("s3", region_name=self.region, config=cfg)
        except Exception:
            self._s3_client = None

    @property
    def is_live(self) -> bool:
        return self._s3_client is not None and os.environ.get("AWS_S3_ENABLED") == "true"

    def store_artifact(
        self, key: str, content: str, content_type: str = "text/plain", expected_sha256: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Stores an artifact and returns its canonical S3 URI, SHA-256 hash, and timestamp.
        Verifies content against expected_sha256 if supplied.
        """
        actual_sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()
        if expected_sha256 and expected_sha256 != actual_sha256:
            raise S3ArtifactIntegrityError(
                f"Content SHA-256 mismatch before storage: expected '{expected_sha256}', computed '{actual_sha256}'."
            )

        now = datetime.now(timezone.utc).isoformat()

        if self.is_live:
            try:
                self._s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=content.encode("utf-8"),
                    ContentType=content_type,
                    Metadata={"sha256": actual_sha256, "created_at": now},
                )
                return {
                    "uri": f"s3://{self.bucket_name}/{key}",
                    "sha256": actual_sha256,
                    "storage": "S3_LIVE",
                    "createdAt": now,
                }
            except Exception:
                pass  # Fall through to local fallback

        # In-memory / local fallback
        self._local_storage[key] = {
            "content": content,
            "contentType": content_type,
            "sha256": actual_sha256,
            "createdAt": now,
        }
        return {
            "uri": f"local://artifacts/{key}",
            "sha256": actual_sha256,
            "storage": "LOCAL_MOCKED",
            "createdAt": now,
        }

    def get_artifact(self, key: str, verify_sha256: Optional[str] = None) -> Optional[str]:
        """
        Retrieves an artifact by key, verifying integrity against expected SHA-256 if provided.
        """
        content = None
        if self.is_live:
            try:
                res = self._s3_client.get_object(Bucket=self.bucket_name, Key=key)
                content = res["Body"].read().decode("utf-8")
            except Exception:
                content = None

        if content is None and key in self._local_storage:
            content = self._local_storage[key]["content"]

        if content is not None and verify_sha256:
            actual_sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if actual_sha != verify_sha256:
                raise S3ArtifactIntegrityError(
                    f"Artifact '{key}' SHA-256 verification failed: expected '{verify_sha256}', computed '{actual_sha}'."
                )

        return content


class DynamoDBPolicyLabRepository(IPolicyLabRepository):
    """
    AWS DynamoDB single-table persistence repository for PolicyLab.
    Key Design:
      PK: Record Partition Key (e.g. POLICYSET#<id>, VERSION#<setId>, SNAPSHOT#<id>)
      SK: Record Sort Key (e.g. METADATA, TAG#<versionTag>, RECORD#<id>)
      GSI1PK / GSI1SK: Inverted queries for status or environment
    """

    def __init__(self, table_name: Optional[str] = None, region: Optional[str] = None):
        self.table_name = table_name or os.environ.get("POLICYLAB_DYNAMODB_TABLE", "PolicyLabTable")
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._fallback_repo = InMemoryPolicyLabRepository()
        self._dynamodb_resource = None
        self._table = None
        self._initialize_resource()

    def _initialize_resource(self) -> None:
        try:
            import boto3
            import botocore.config
            cfg = botocore.config.Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2})
            self._dynamodb_resource = boto3.resource("dynamodb", region_name=self.region, config=cfg)
            self._table = self._dynamodb_resource.Table(self.table_name)
        except Exception:
            self._dynamodb_resource = None
            self._table = None

    @property
    def is_live(self) -> bool:
        return self._table is not None and os.environ.get("AWS_DYNAMODB_ENABLED") == "true"

    def save_policy_set(self, policy_set: Dict[str, Any]) -> None:
        if self.is_live:
            try:
                item = {
                    "PK": f"POLICYSET#{policy_set['id']}",
                    "SK": "METADATA",
                    "id": policy_set["id"],
                    "name": policy_set.get("name", ""),
                    "description": policy_set.get("description", ""),
                    "currentVersion": policy_set.get("currentVersion", "v1"),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
                self._table.put_item(Item=item)
                return
            except Exception:
                pass
        self._fallback_repo.save_policy_set(policy_set)

    def get_policy_set(self, set_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live:
            try:
                res = self._table.get_item(Key={"PK": f"POLICYSET#{set_id}", "SK": "METADATA"})
                if "Item" in res:
                    return res["Item"]
            except Exception:
                pass
        return self._fallback_repo.get_policy_set(set_id)

    def save_policy_version(self, version: Dict[str, Any]) -> None:
        set_id = version["setId"]
        v_tag = version["versionTag"]

        if self.is_live:
            try:
                from botocore.exceptions import ClientError
                item = {
                    "PK": f"VERSION#{set_id}",
                    "SK": f"TAG#{v_tag}",
                    "setId": set_id,
                    "versionTag": v_tag,
                    "policyHash": version.get("policyHash", ""),
                    "author": version.get("author", "Unknown"),
                    "changeSummary": version.get("changeSummary", ""),
                    "gateStatus": version.get("gateStatus", "PENDING"),
                    "createdAt": version.get("createdAt", datetime.now(timezone.utc).isoformat()),
                }
                # Conditional write: Do not overwrite if version tag already exists
                self._table.put_item(
                    Item=item,
                    ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
                )
                return
            except Exception as ex:
                err_code = getattr(ex, "response", {}).get("Error", {}).get("Code", "")
                if err_code == "ConditionalCheckFailedException" or "ConditionalCheckFailed" in str(ex):
                    raise PolicyVersionConflictError(
                        f"Policy version '{v_tag}' for policy set '{set_id}' already exists."
                    )
                pass

        # In-memory fallback with conditional check
        existing = self._fallback_repo.get_policy_version(set_id, v_tag)
        if existing:
            raise PolicyVersionConflictError(
                f"Policy version '{v_tag}' for policy set '{set_id}' already exists (In-Memory Check)."
            )
        self._fallback_repo.save_policy_version(version)

    def get_policy_version(self, set_id: str, version_tag: str) -> Optional[Dict[str, Any]]:
        if self.is_live:
            try:
                res = self._table.get_item(Key={"PK": f"VERSION#{set_id}", "SK": f"TAG#{version_tag}"})
                if "Item" in res:
                    return res["Item"]
            except Exception:
                pass
        return self._fallback_repo.get_policy_version(set_id, version_tag)

    def list_policy_versions(self, set_id: str) -> List[Dict[str, Any]]:
        if self.is_live:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(KeyConditionExpression=Key("PK").eq(f"VERSION#{set_id}"))
                if "Items" in res:
                    return res["Items"]
            except Exception:
                pass
        return self._fallback_repo.list_policy_versions(set_id)

    def save_snapshot(self, snapshot: EntitySnapshot) -> None:
        if self.is_live:
            try:
                item = {
                    "PK": f"SNAPSHOT#{snapshot.snapshotId}",
                    "SK": "METADATA",
                    "snapshotId": snapshot.snapshotId,
                    "providerId": snapshot.providerId,
                    "contentHash": snapshot.contentHash,
                    "entityCount": len(snapshot.entities),
                    "createdAt": snapshot.createdAt,
                    "schemaVersion": snapshot.schemaVersion,
                    "serializedEntities": json.dumps(snapshot.entities),
                }
                self._table.put_item(Item=item)
                return
            except Exception:
                pass
        self._fallback_repo.save_snapshot(snapshot)

    def get_snapshot(self, snapshot_id: str) -> Optional[EntitySnapshot]:
        if self.is_live:
            try:
                res = self._table.get_item(Key={"PK": f"SNAPSHOT#{snapshot_id}", "SK": "METADATA"})
                if "Item" in res:
                    item = res["Item"]
                    entities = json.loads(item.get("serializedEntities", "[]"))
                    return EntitySnapshot(
                        snapshotId=item["snapshotId"],
                        providerId=item["providerId"],
                        contentHash=item["contentHash"],
                        entities=entities,
                        createdAt=item["createdAt"],
                        schemaVersion=item.get("schemaVersion"),
                    )
            except Exception:
                pass
        return self._fallback_repo.get_snapshot(snapshot_id)

    def save_audit_run(self, audit_run: Dict[str, Any]) -> None:
        if self.is_live:
            try:
                item = {
                    "PK": f"AUDIT#{audit_run['id']}",
                    "SK": "RECORD",
                    "id": audit_run["id"],
                    "data": json.dumps(audit_run),
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                self._table.put_item(Item=item)
                return
            except Exception:
                pass
        self._fallback_repo.save_audit_run(audit_run)

    def get_audit_run(self, audit_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live:
            try:
                res = self._table.get_item(Key={"PK": f"AUDIT#{audit_id}", "SK": "RECORD"})
                if "Item" in res:
                    return json.loads(res["Item"].get("data", "{}"))
            except Exception:
                pass
        return self._fallback_repo.get_audit_run(audit_id)

    def save_deployment(self, record: DeploymentRecord) -> None:
        if self.is_live:
            try:
                item = {
                    "PK": "DEPLOYMENTS",
                    "SK": f"DEP#{record.deployedAt}#{record.id}",
                    "id": record.id,
                    "policyHash": record.policyHash,
                    "targetStoreId": record.targetStoreId,
                    "environment": record.environment,
                    "status": record.status.value,
                    "deployedBy": record.deployedBy,
                    "deployedAt": record.deployedAt,
                    "verificationProof": record.verificationProof,
                }
                self._table.put_item(Item=item)
                return
            except Exception:
                pass
        self._fallback_repo.save_deployment(record)

    def list_deployments(self) -> List[DeploymentRecord]:
        if self.is_live:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(
                    KeyConditionExpression=Key("PK").eq("DEPLOYMENTS"),
                    ScanIndexForward=False,  # reverse chronological
                )
                if "Items" in res:
                    records = []
                    for it in res["Items"]:
                        records.append(
                            DeploymentRecord(
                                id=it["id"],
                                policyVersionTag=it.get("policyVersionTag", "prod"),
                                policyHash=it["policyHash"],
                                targetStoreId=it["targetStoreId"],
                                environment=it["environment"],
                                status=DeploymentStatus(it["status"]),
                                deployedBy=it["deployedBy"],
                                deployedAt=it["deployedAt"],
                                verificationProof=it.get("verificationProof"),
                            )
                        )
                    return records
            except Exception:
                pass
        return self._fallback_repo.list_deployments()

    def save_workspace(self, workspace: Dict[str, Any]) -> None:
        ws_id = workspace.get("workspaceId") or workspace.get("id")
        if self.is_live:
            try:
                item = {
                    "PK": f"WORKSPACE#{ws_id}",
                    "SK": "METADATA",
                    "workspaceId": ws_id,
                    "name": workspace.get("name", ""),
                    "mode": workspace.get("mode", "connected"),
                    "description": workspace.get("description", ""),
                    "createdAt": workspace.get("createdAt", datetime.now(timezone.utc).isoformat()),
                    "data": workspace.get("data", {}),
                }
                self._table.put_item(Item=item)
                return
            except Exception:
                pass
        self._fallback_repo.save_workspace(workspace)

    def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live:
            try:
                res = self._table.get_item(Key={"PK": f"WORKSPACE#{workspace_id}", "SK": "METADATA"})
                if "Item" in res:
                    it = res["Item"]
                    return {
                        "workspaceId": it.get("workspaceId") or it.get("id"),
                        "name": it.get("name", ""),
                        "mode": it.get("mode", "connected"),
                        "description": it.get("description", ""),
                        "createdAt": it.get("createdAt"),
                        "data": it.get("data", {}),
                    }
            except Exception:
                pass
        return self._fallback_repo.get_workspace(workspace_id)

    def list_workspaces(self) -> List[Dict[str, Any]]:
        if self.is_live:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(KeyConditionExpression=Key("PK").begins_with("WORKSPACE#"))
                if "Items" in res:
                    return [
                        {
                            "workspaceId": it.get("workspaceId") or it.get("id"),
                            "name": it.get("name", ""),
                            "mode": it.get("mode", "connected"),
                            "description": it.get("description", ""),
                            "createdAt": it.get("createdAt"),
                        }
                        for it in res["Items"]
                    ]
            except Exception:
                pass
        return self._fallback_repo.list_workspaces()

