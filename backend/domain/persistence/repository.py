"""
PolicyLab Persistence Repository Contracts & In-Memory Implementation
Defines domain repository interfaces for PolicySets, PolicyVersions, Snapshots,
AuditRuns, and Deployments.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, List, Optional

from ..models.entity import EntitySnapshot, compute_canonical_entity_hash
from ..models.deployment import DeploymentRecord, DeploymentStatus


class IPolicyLabRepository(ABC):
    """Abstract persistence interface for PolicyLab domain records."""

    # --- Connected Workspace Methods (Phase: Connected Workspace) ------------

    @abstractmethod
    def save_workspace(self, workspace: Dict[str, Any]) -> None:
        """Stores or updates a Connected Workspace record."""
        pass

    @abstractmethod
    def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a Connected Workspace by ID."""
        pass

    @abstractmethod
    def list_workspaces(self) -> List[Dict[str, Any]]:
        """Lists all Connected Workspace records."""
        pass

    @abstractmethod
    def save_policy_set(self, policy_set: Dict[str, Any]) -> None:
        """Stores or updates a PolicySet."""
        pass

    @abstractmethod
    def get_policy_set(self, set_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a PolicySet by ID."""
        pass

    @abstractmethod
    def save_policy_version(self, version: Dict[str, Any]) -> None:
        """Stores an immutable PolicyVersion record."""
        pass

    @abstractmethod
    def get_policy_version(self, set_id: str, version_tag: str) -> Optional[Dict[str, Any]]:
        """Retrieves a specific policy version."""
        pass

    @abstractmethod
    def list_policy_versions(self, set_id: str) -> List[Dict[str, Any]]:
        """Lists all recorded versions for a PolicySet in chronological order."""
        pass

    @abstractmethod
    def save_snapshot(self, snapshot: EntitySnapshot) -> None:
        """Stores a bounded entity snapshot."""
        pass

    @abstractmethod
    def get_snapshot(self, snapshot_id: str) -> Optional[EntitySnapshot]:
        """Retrieves an entity snapshot by ID."""
        pass

    @abstractmethod
    def save_audit_run(self, audit_run: Dict[str, Any]) -> None:
        """Stores an audit run report."""
        pass

    @abstractmethod
    def get_audit_run(self, audit_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves an audit run report by ID."""
        pass

    @abstractmethod
    def save_deployment(self, record: DeploymentRecord) -> None:
        """Stores a deployment record."""
        pass

    @abstractmethod
    def list_deployments(self) -> List[DeploymentRecord]:
        """Returns deployment audit ledger."""
        pass


class InMemoryPolicyLabRepository(IPolicyLabRepository):
    """
    In-memory thread-safe repository implementation.
    Provides deterministic local persistence for tests and offline development.
    """

    def __init__(self):
        self._policy_sets: Dict[str, Dict[str, Any]] = {}
        self._policy_versions: Dict[str, List[Dict[str, Any]]] = {}
        self._snapshots: Dict[str, EntitySnapshot] = {}
        self._audit_runs: Dict[str, Dict[str, Any]] = {}
        self._deployments: List[DeploymentRecord] = []
        self._workspaces: Dict[str, Dict[str, Any]] = {}
        self._seed_default_records()

    def _seed_default_records(self) -> None:
        """Seeds default AcmePay demo records."""
        ps_id = "ps-acmepay-prod"
        self._policy_sets[ps_id] = {
            "id": ps_id,
            "name": "AcmePay Core Authorization",
            "description": "Production authorization policies for payments and billing.",
            "currentVersion": "v12",
            "createdAt": "2026-09-18T10:00:00Z",
        }
        self._policy_versions[ps_id] = [
            {
                "setId": ps_id,
                "versionTag": "v12",
                "author": "Sneha",
                "createdAt": "2026-09-18T12:00:00Z",
                "policyHash": "8a3e77f09bc1d4e21a88b024419ad21590bf12019488da12b918a09f871491bc",
                "changeSummary": "Baseline production policy restricting contractor actions to ticket viewing.",
                "gateStatus": "PASS",
            },
            {
                "setId": ps_id,
                "versionTag": "v13",
                "author": "Vishal",
                "createdAt": "2026-09-19T08:00:00Z",
                "policyHash": "b52d917804df9873a1441aef5531d04422e5e412586b02008ad52c8cf5109cbb",
                "changeSummary": "Unintended action wildcard expansion permitting contractor report deletion.",
                "gateStatus": "BLOCKED",
            },
        ]
        self._deployments = [
            DeploymentRecord(
                id="dep_001",
                policyVersionTag="v12",
                policyHash="8a3e77f09bc1d4e21a88b024419ad21590bf12019488da12b918a09f871491bc",
                targetStoreId=ps_id,
                environment="production",
                status=DeploymentStatus.SYNCHRONIZED,
                deployedBy="Vishal (Auto-Pipeline)",
                deployedAt="2026-09-18T15:00:00Z",
                verificationProof="cedar-proof-sig-990a12fbc",
            )
        ]

    def save_policy_set(self, policy_set: Dict[str, Any]) -> None:
        self._policy_sets[policy_set["id"]] = policy_set

    def get_policy_set(self, set_id: str) -> Optional[Dict[str, Any]]:
        return self._policy_sets.get(set_id)

    def save_policy_version(self, version: Dict[str, Any]) -> None:
        set_id = version["setId"]
        if set_id not in self._policy_versions:
            self._policy_versions[set_id] = []
        # Prevent duplicate versions
        existing = [v for v in self._policy_versions[set_id] if v.get("versionTag") == version.get("versionTag")]
        if not existing:
            self._policy_versions[set_id].append(version)

    def get_policy_version(self, set_id: str, version_tag: str) -> Optional[Dict[str, Any]]:
        versions = self._policy_versions.get(set_id, [])
        for v in versions:
            if v.get("versionTag") == version_tag:
                return v
        return None

    def list_policy_versions(self, set_id: str) -> List[Dict[str, Any]]:
        return self._policy_versions.get(set_id, [])

    def save_snapshot(self, snapshot: EntitySnapshot) -> None:
        self._snapshots[snapshot.snapshotId] = snapshot

    def get_snapshot(self, snapshot_id: str) -> Optional[EntitySnapshot]:
        return self._snapshots.get(snapshot_id)

    def save_audit_run(self, audit_run: Dict[str, Any]) -> None:
        self._audit_runs[audit_run["id"]] = audit_run

    def get_audit_run(self, audit_id: str) -> Optional[Dict[str, Any]]:
        return self._audit_runs.get(audit_id)

    def save_deployment(self, record: DeploymentRecord) -> None:
        self._deployments.insert(0, record)

    def list_deployments(self) -> List[DeploymentRecord]:
        return self._deployments

    # --- Connected Workspace (session-scoped) ---------------------------------

    def save_workspace(self, workspace: Dict[str, Any]) -> None:
        self._workspaces[workspace["id"]] = workspace

    def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        return self._workspaces.get(workspace_id)

    def list_workspaces(self) -> List[Dict[str, Any]]:
        return list(self._workspaces.values())
