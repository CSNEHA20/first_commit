"""
PolicyLab Canonical Evidence Provenance & Lineage Models (Stage E)
Establishes cryptographic integrity, deterministic lineage chains,
and clear classification standards for all authorization evidence.
"""

from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .authz import CanonicalEvidence, EvaluationStatus
from .entity import EntitySnapshot, compute_canonical_entity_hash


class EvidenceClassification(str, Enum):
    """
    Strict taxonomic classification of evidence items to distinguish deterministic
    engine proof from AI synthesis and human operator decisions.
    """
    NATIVE_CEDAR_OUTPUT = "NATIVE_CEDAR_OUTPUT"
    VALIDATION_OUTPUT = "VALIDATION_OUTPUT"
    DETERMINISTIC_FINDING = "DETERMINISTIC_FINDING"
    RUNTIME_DIAGNOSTICS = "RUNTIME_DIAGNOSTICS"
    AI_EXPLANATION = "AI_EXPLANATION"
    AI_REMEDIATION_SUGGESTION = "AI_REMEDIATION_SUGGESTION"
    HUMAN_DECISION = "HUMAN_DECISION"
    DEPLOYMENT_SERVICE_RESPONSE = "DEPLOYMENT_SERVICE_RESPONSE"


def compute_evidence_sha256(evidence_dict: Dict[str, Any]) -> str:
    """Computes deterministic SHA-256 digest of serialized evidence."""
    serialized = json.dumps(evidence_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class EvidenceProvenanceNode(BaseModel):
    """Individual node in the verification provenance graph."""
    nodeId: str
    classification: EvidenceClassification
    sourceComponent: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    contentHash: str
    parentHashes: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceLineageChain(BaseModel):
    """
    Immutable lineage graph linking authorization lifecycle:
    Policy inputs -> Validation -> Entity inputs -> Cedar evaluations -> Behavioral diff ->
    Counterexamples -> Security contracts -> Regression report -> Gate decision -> Deployment.
    """
    chainId: str
    policyVersionTag: str
    policyHash: str
    entitySnapshotId: Optional[str] = None
    entitySnapshotHash: Optional[str] = None
    validationHash: Optional[str] = None
    regressionRunId: Optional[str] = None
    gateDecisionStatus: Optional[str] = None
    approvalId: Optional[str] = None
    nodes: List[EvidenceProvenanceNode] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def add_node(
        self,
        node_id: str,
        classification: EvidenceClassification,
        source_component: str,
        content_payload: Dict[str, Any],
        parent_hashes: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> EvidenceProvenanceNode:
        content_hash = compute_evidence_sha256(content_payload)
        node = EvidenceProvenanceNode(
            nodeId=node_id,
            classification=classification,
            sourceComponent=source_component,
            contentHash=content_hash,
            parentHashes=parent_hashes or [],
            metadata=metadata or {},
        )
        self.nodes.append(node)
        return node
