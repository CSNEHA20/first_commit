"""
PolicyLab Effective Access Matrix Service (P1 Feature - Stage J1)
Computes effective authorization decisions across a 2D matrix:
Rows: Principals / Roles
Columns: Actions x Resource classes
Cells: ALLOW, DENY, CONDITIONAL, CHANGED with evidence drill-down references.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from ..models.authz import (
    AuthorizationDecision,
    AuthorizationRequest,
    CanonicalEvidence,
)
from ..models.entity import IEntityProvider
from .evaluation import CedarEvaluationService


class AccessMatrixCell(BaseModel):
    principal: str
    action: str
    resource: str
    decision: AuthorizationDecision
    determiningPolicies: List[str] = Field(default_factory=list)
    evidenceId: Optional[str] = None
    isChanged: Optional[bool] = None
    baselineDecision: Optional[AuthorizationDecision] = None


class AccessMatrixRow(BaseModel):
    rowKey: str  # Principal or Role
    roleName: Optional[str] = None
    cells: Dict[str, AccessMatrixCell] = Field(default_factory=dict)  # columnKey -> Cell


class AccessMatrixReport(BaseModel):
    principals: List[str]
    actions: List[str]
    resources: List[str]
    columnKeys: List[str]
    rows: List[AccessMatrixRow]
    totalEvaluations: int
    allowCount: int
    denyCount: int
    changedCount: int = 0


class AccessMatrixService:
    """
    Computes effective permission surfaces across declared principals and actions/resources.
    """

    def __init__(self, evaluation_service: Optional[CedarEvaluationService] = None):
        self.evaluation_service = evaluation_service or CedarEvaluationService()

    def generate_matrix(
        self,
        policy_text: str,
        principals: List[str],
        actions: List[str],
        resources: List[str],
        entities: Optional[List[Dict[str, Any]]] = None,
        schema_text: Optional[str] = None,
        baseline_policy_text: Optional[str] = None,
    ) -> AccessMatrixReport:
        rows: List[AccessMatrixRow] = []
        total_evals = 0
        allow_count = 0
        deny_count = 0
        changed_count = 0

        # Pre-compute column keys: Action + " on " + Resource
        col_keys = [f"{a} on {r}" for a in actions for r in resources]

        for p in principals:
            row_cells: Dict[str, AccessMatrixCell] = {}

            for a in actions:
                for r in resources:
                    col_k = f"{a} on {r}"
                    req = AuthorizationRequest(
                        principal=p,
                        action=a,
                        resource=r,
                        policyText=policy_text,
                        schemaText=schema_text,
                        entities=entities or [],
                    )
                    evidence = self.evaluation_service.evaluate(req)
                    total_evals += 1

                    if evidence.decision == AuthorizationDecision.ALLOW:
                        allow_count += 1
                    else:
                        deny_count += 1

                    is_changed = None
                    base_dec = None
                    if baseline_policy_text:
                        base_req = AuthorizationRequest(
                            principal=p,
                            action=a,
                            resource=r,
                            policyText=baseline_policy_text,
                            schemaText=schema_text,
                            entities=entities or [],
                        )
                        base_evidence = self.evaluation_service.evaluate(base_req)
                        base_dec = base_evidence.decision
                        is_changed = (evidence.decision != base_evidence.decision)
                        if is_changed:
                            changed_count += 1

                    row_cells[col_k] = AccessMatrixCell(
                        principal=p,
                        action=a,
                        resource=r,
                        decision=evidence.decision,
                        determiningPolicies=evidence.determiningPolicies,
                        evidenceId=evidence.evidenceId,
                        isChanged=is_changed,
                        baselineDecision=base_dec,
                    )

            rows.append(
                AccessMatrixRow(
                    rowKey=p,
                    cells=row_cells,
                )
            )

        return AccessMatrixReport(
            principals=principals,
            actions=actions,
            resources=resources,
            columnKeys=col_keys,
            rows=rows,
            totalEvaluations=total_evals,
            allowCount=allow_count,
            denyCount=deny_count,
            changedCount=changed_count,
        )
