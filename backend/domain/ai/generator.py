"""
PolicyLab Natural Language Policy Generator (P1 Feature - Stage F4)
Synthesizes candidate Cedar authorization policies from plain-language requirements
using Amazon Bedrock (Anthropic Claude 3.5 Sonnet) with deterministic template fallback.
CRITICAL: All generated policies are untrusted drafts and strictly require
validation, semantic diff, and regression gate checks before deployment.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import json
import os
import re
from typing import Optional
from pydantic import BaseModel, Field

from ..cedar.validation import CedarValidationService


class PolicyGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Natural language authorization requirement")
    schemaText: Optional[str] = Field(None, description="Cedar schema context")
    existingPolicyText: Optional[str] = Field(None, description="Existing policy set context")
    intent: Optional[str] = Field(None, description="E.g., PERMIT_NEW_ROLE, RESTRICT_ACCESS")


class PolicyGenerationResponse(BaseModel):
    generatedCedar: str
    isTrusted: bool = False
    requiresValidation: bool = True
    rationale: str
    provider: str
    isFallback: bool = False
    generatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    isValidSyntax: Optional[bool] = None
    validationErrors: list[str] = Field(default_factory=list)


class IPolicyGeneratorProvider(ABC):
    @abstractmethod
    def generate(self, request: PolicyGenerationRequest) -> PolicyGenerationResponse:
        pass


class DeterministicTemplatePolicyGenerator(IPolicyGeneratorProvider):
    """
    Deterministic rule-based policy generator.
    Guarantees 100% offline reproducibility for standard authorization patterns.
    """

    def generate(self, request: PolicyGenerationRequest) -> PolicyGenerationResponse:
        prompt_lower = request.prompt.lower()

        if "admin" in prompt_lower:
            cedar_code = (
                "// Generated Policy: Full Administrative Access\n"
                "permit (\n"
                "    principal in Role::\"admin\",\n"
                "    action,\n"
                "    resource\n"
                ");"
            )
            rationale = "Generated full administrator permit clause matching role 'admin'."
        elif "editor" in prompt_lower and ("view" in prompt_lower or "read" in prompt_lower):
            cedar_code = (
                "// Generated Policy: Editor Read Access\n"
                "permit (\n"
                "    principal in Role::\"editor\",\n"
                "    action in [Action::\"view\"],\n"
                "    resource is Invoice\n"
                ");"
            )
            rationale = "Generated read-only permit policy for editor role on Invoice resources."
        elif "contractor" in prompt_lower and ("ticket" in prompt_lower or "support" in prompt_lower):
            cedar_code = (
                "// Generated Policy: Contractor Ticket Access\n"
                "permit (\n"
                "    principal in Role::\"contractor\",\n"
                "    action == Action::\"view\",\n"
                "    resource is SupportTicket\n"
                ");"
            )
            rationale = "Generated bounded permit policy for contractor role restricted to SupportTicket resources."
        elif "finance" in prompt_lower or "payroll" in prompt_lower:
            cedar_code = (
                "// Generated Policy: Finance Manager Payroll Access\n"
                "permit (\n"
                "    principal in Role::\"finance_manager\",\n"
                "    action in [Action::\"view\", Action::\"approve\"],\n"
                "    resource is PayrollReport\n"
                ");"
            )
            rationale = "Generated finance role permit policy for payroll reporting."
        else:
            cedar_code = (
                "// Generated Policy: Default Least-Privilege Scaffold\n"
                "permit (\n"
                "    principal in Role::\"viewer\",\n"
                "    action == Action::\"view\",\n"
                "    resource\n"
                ");"
            )
            rationale = "Generated standard least-privilege view template."

        return PolicyGenerationResponse(
            generatedCedar=cedar_code,
            isTrusted=False,
            requiresValidation=True,
            rationale=rationale,
            provider="deterministic-template",
            isFallback=False,
        )


class BedrockPolicyGenerator(IPolicyGeneratorProvider):
    """
    Live Amazon Bedrock generator using Anthropic Claude 3.5 Sonnet.
    """

    def __init__(self, region: Optional[str] = None, model_id: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"):
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self.model_id = model_id
        self._fallback = DeterministicTemplatePolicyGenerator()

    def generate(self, request: PolicyGenerationRequest) -> PolicyGenerationResponse:
        try:
            import boto3
            client = boto3.client("bedrock-runtime", region_name=self.region)

            system_prompt = (
                "You are an AWS Cedar authorization policy author. "
                "Generate a valid Cedar policy statement based on the user requirement. "
                "CRITICAL: Return ONLY a valid JSON object matching this schema:\n"
                "{\n"
                '  "cedarPolicy": "...",\n'
                '  "rationale": "..."\n'
                "}\n"
                "Do NOT include explanations or markdown outside the JSON."
            )

            user_msg = f"Requirement: {request.prompt}\n"
            if request.schemaText:
                user_msg += f"Cedar Schema:\n{request.schemaText}\n"
            if request.existingPolicyText:
                user_msg += f"Existing Policy:\n{request.existingPolicyText}\n"

            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 800,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_msg}],
                "temperature": 0.0,
            })

            res = client.invoke_model(
                modelId=self.model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            resp_body = json.loads(res["body"].read().decode("utf-8"))
            content = resp_body["content"][0]["text"].strip()

            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return PolicyGenerationResponse(
                    generatedCedar=data.get("cedarPolicy", ""),
                    isTrusted=False,
                    requiresValidation=True,
                    rationale=data.get("rationale", "Generated by Amazon Bedrock."),
                    provider=f"bedrock:{self.model_id}",
                    isFallback=False,
                )
        except Exception:
            pass

        fb = self._fallback.generate(request)
        fb.isFallback = True
        return fb


class PolicyGeneratorService:
    """
    Coordinates policy generation and automatically executes deterministic Cedar syntax validation
    on the generated draft before returning it to the caller.
    """

    def __init__(
        self,
        provider: Optional[IPolicyGeneratorProvider] = None,
        validator: Optional[CedarValidationService] = None,
    ):
        if provider:
            self.provider = provider
        elif os.environ.get("AWS_BEDROCK_ENABLED") == "true":
            self.provider = BedrockPolicyGenerator()
        else:
            self.provider = DeterministicTemplatePolicyGenerator()
        self.validator = validator or CedarValidationService()

    def generate_candidate_policy(self, request: PolicyGenerationRequest) -> PolicyGenerationResponse:
        if not request.prompt or not request.prompt.strip():
            raise ValueError("Prompt cannot be empty for policy generation.")

        response = self.provider.generate(request)

        # Deterministically validate generated Cedar syntax
        val_res = self.validator.validate(response.generatedCedar, request.schemaText)
        response.isValidSyntax = val_res.isValid
        response.validationErrors = [e.message for e in val_res.errors]
        return response
