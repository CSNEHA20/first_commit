"""
PolicyLab Version Timeline Service (P1 Feature - Stage J3)
Tracks policy version history, immutable digests, author attributions,
change summaries, and verification gate outcomes.
"""

from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .repository import IPolicyLabRepository, InMemoryPolicyLabRepository


class PolicyVersionTimelineEntry(BaseModel):
    setId: str
    versionTag: str
    author: str
    createdAt: str
    policyHash: str
    changeSummary: str
    gateStatus: str
    isCurrent: bool = False
    parentVersionTag: Optional[str] = None


class VersionTimelineService:
    """
    Manages chronological version lineage for PolicyLab PolicySets.
    """

    def __init__(self, repository: Optional[IPolicyLabRepository] = None):
        self.repository = repository or InMemoryPolicyLabRepository()

    def get_timeline(self, set_id: str) -> List[PolicyVersionTimelineEntry]:
        p_set = self.repository.get_policy_set(set_id)
        current_version = p_set.get("currentVersion") if p_set else None
        versions = self.repository.list_policy_versions(set_id)

        timeline: List[PolicyVersionTimelineEntry] = []
        prev_tag = None
        for v in versions:
            v_tag = v.get("versionTag", "v0")
            entry = PolicyVersionTimelineEntry(
                setId=set_id,
                versionTag=v_tag,
                author=v.get("author", "Unknown"),
                createdAt=v.get("createdAt", datetime.now(timezone.utc).isoformat()),
                policyHash=v.get("policyHash", ""),
                changeSummary=v.get("changeSummary", "No summary provided"),
                gateStatus=v.get("gateStatus", "PENDING"),
                isCurrent=(v_tag == current_version),
                parentVersionTag=prev_tag,
            )
            timeline.append(entry)
            prev_tag = v_tag

        return timeline

    def record_version(
        self,
        set_id: str,
        version_tag: str,
        policy_text: str,
        author: str,
        change_summary: str,
        gate_status: str = "PENDING",
    ) -> PolicyVersionTimelineEntry:
        clean_lines = [line.rstrip() for line in policy_text.strip().splitlines() if line.strip()]
        policy_hash = hashlib.sha256("\n".join(clean_lines).encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc).isoformat()

        record = {
            "setId": set_id,
            "versionTag": version_tag,
            "author": author,
            "createdAt": now,
            "policyHash": policy_hash,
            "changeSummary": change_summary,
            "gateStatus": gate_status,
        }
        self.repository.save_policy_version(record)

        timeline = self.get_timeline(set_id)
        for t in timeline:
            if t.versionTag == version_tag:
                return t
        return PolicyVersionTimelineEntry(**record, isCurrent=False)
