# PolicyLab — AWS Integration Status Inventory

**Document Version:** 2.0.0  
**Phase:** 10 — Final Release Verification, Live AWS Probes & End-to-End Reliability  
**Timestamp:** 2026-09-20T05:45:00Z  
**Hackathon Team:** VibeSync (Vishal Lakshmikanthan & Sneha C.)  
**Repository:** [PolicyLab](https://github.com/Vishallakshmikanthan/policylab)

---

## 1. Executive Status Overview

In strict adherence to Non-Negotiable Rule 3 (*"Do not claim an AWS integration is live merely because a flag, adapter, or resource exists"*) and Rule 4 (*"Never fabricate tests, logs, policy decisions, counterexamples, deployment results, or AWS responses"*), this inventory truthfully reports the live verification state of each AWS service integration.

PolicyLab operates in **Dual-Execution Mode**:
- **Offline / Local Simulation Mode (`dev`):** Uses deterministic in-memory fakes, local artifact caches, and local Cedar WASM binaries. Provides 100% of Cedar evaluation, behavioral diffing, counterexample generation, security contracts, pre-deployment gate enforcement, and grounded template explanations without requiring AWS credentials or incurring cloud costs ($0.00 spent).
- **Live AWS Mode (`prod` / `strict`):** Boto3 SDK clients for Amazon Verified Permissions, Amazon Bedrock, DynamoDB, S3, and Step Functions activate automatically when credentials and environment variables are configured.

### Live Environment Probe Findings
Active AWS credentials were detected on the host runtime:
- **IAM Principal:** `arn:aws:iam::583365238271:user/vishal`
- **Configured Region:** `us-east-1`
- **Authentication Method:** Shared credentials file (`~/.aws/credentials`)

When live service probes were executed using this principal, every service returned concrete API responses documenting exact authorization boundaries:
1. **Verified Permissions:** `AccessDeniedException: The AWS Access Key Id needs a subscription for the service`
2. **Bedrock:** `ResourceNotFoundException: This model version has reached the end of its life.` / `AccessDeniedException: User is not authorized to perform: bedrock:ListFoundationModels`
3. **DynamoDB:** `AccessDeniedException: User is not authorized to perform: dynamodb:ListTables on resource: arn:aws:dynamodb:us-east-1:583365238271:table/*`
4. **S3:** `AccessDenied: User is not authorized to perform: s3:ListAllMyBuckets`
5. **Step Functions:** `AccessDeniedException: User is not authorized to perform: states:ListStateMachines on resource: arn:aws:states:us-east-1:583365238271:stateMachine:*`
6. **CloudFormation:** `AccessDenied: User is not authorized to perform: cloudformation:ListStacks`
7. **Cognito IDP:** `AccessDeniedException: User is not authorized to perform: cognito-idp:ListUserPools on resource: *`

**Conclusion:** All AWS SDK clients and adapters are fully authored, packaged, and tested against deterministic mock fixtures and fail-closed error boundaries. Because external cloud permissions are currently denied for user `vishal`, PolicyLab truthfully and safely operates in its verified `LOCAL_MOCKED` offline mode.

---

## 2. Comprehensive Service Integration Matrix

| # | AWS Integration | Status | Code Location | Test Coverage | Live Verification Evidence & Probed Error | Configuration Prerequisites | Next Verification Action |
|---|---|:---:|---|---|---|---|---|
| **1** | **Amazon Verified Permissions (AVP)** | **LOCAL_MOCKED** (Adapter Live-Ready, Probed) | `backend/domain/avp/adapter.py` | `tests/unit/test_avp_adapter.py`<br>`tests/integration/test_end_to_end_acceptance.py` | `Boto3AVPAdapter` implemented with `boto3.client('verifiedpermissions')`. Live probe returned `AccessDeniedException: The AWS Access Key Id needs a subscription for the service`. Fallback to `DeterministicFakeAVPAdapter` active. | `AWS_REGION`<br>`AVP_POLICY_STORE_ID`<br>`AWS_ACCESS_KEY_ID`<br>`AWS_SECRET_ACCESS_KEY` | Enable Verified Permissions subscription in AWS Account, deploy policy store via SAM, set `AWS_AVP_ENABLED=true`. |
| **2** | **Amazon Bedrock** (Claude 3.5 Sonnet) | **LOCAL_MOCKED** (SDK Live-Ready, Probed) | `backend/domain/ai/generator.py`<br>`backend/domain/ai/explanation.py` | `tests/unit/test_ai_explanation.py`<br>`tests/integration/test_end_to_end_acceptance.py` | `BedrockExplanationProvider` calls Claude 3.5 Sonnet. Live probe returned `ResourceNotFoundException: model version EOL` and `AccessDeniedException: bedrock:ListFoundationModels`. Grounded deterministic template fallback active with `isFallback=True`. | `AWS_REGION`<br>`BEDROCK_MODEL_ID`<br>Bedrock model entitlement | Enable Anthropic Claude 3.5 Sonnet v2 / cross-region inference profile in target AWS account; set `AWS_BEDROCK_ENABLED=true`. |
| **3** | **Amazon DynamoDB** | **LOCAL_MOCKED** (SDK Live-Ready, Probed) | `backend/domain/persistence/aws_repository.py`<br>`backend/domain/persistence/dynamo_provider.py` | `tests/unit/test_persistence_adapters.py`<br>`tests/integration/test_end_to_end_acceptance.py` | `DynamoDBPolicyLabRepository` implements single-table design with conditional writes (`attribute_not_exists(PK)`). Live probe returned `AccessDeniedException: dynamodb:ListTables`. In-memory repository fallback active. | `POLICYLAB_DYNAMODB_TABLE`<br>`AWS_REGION`<br>DynamoDB permissions | Attach DynamoDB CRUD policy to IAM principal, provision table via SAM, set `AWS_DYNAMODB_ENABLED=true`. |
| **4** | **Amazon S3** | **LOCAL_MOCKED** (SDK Live-Ready, Probed) | `backend/domain/persistence/aws_repository.py` | `tests/unit/test_persistence_adapters.py`<br>`tests/integration/test_end_to_end_acceptance.py` | `S3ArtifactRepository` implements SHA-256 integrity verification. Live probe returned `AccessDenied: s3:ListAllMyBuckets`. Local in-memory/disk artifact cache active. | `POLICYLAB_ARTIFACT_BUCKET`<br>`AWS_REGION`<br>S3 permissions | Attach S3 PutObject/GetObject policy to IAM principal, provision bucket via SAM, set `AWS_S3_ENABLED=true`. |
| **5** | **AWS Step Functions** | **CONFIGURED** (ASL Validated, Probed) | `infrastructure/statemachines/audit_workflow.asl.json`<br>`backend/lambda_handler.py` | `tests/unit/test_lambda_stepfunctions_handler.py`<br>`tests/integration/test_end_to_end_acceptance.py` | Validated ASL state machine with Choices, Retries, and Task routing. Live probe returned `AccessDeniedException: states:ListStateMachines`. Fail-closed error handling directs caller to synchronous `/audits/agent-run`. | `AUDIT_STATE_MACHINE_ARN`<br>`AWS_REGION` | Deploy State Machine via SAM and grant `states:StartExecution` / `states:DescribeExecution`. |
| **6** | **AWS Lambda** | **CONFIGURED** (Mangum + Task Handler) | `backend/lambda_handler.py` | `tests/unit/test_lambda_stepfunctions_handler.py`<br>`tests/integration/test_end_to_end_acceptance.py` | Mangum ASGI adapter for API Gateway HTTP API and direct handler for Step Functions task execution. Fully tested with mock context. | Python 3.11 runtime<br>512MB RAM, 30s timeout | Package via `sam build` and test cold start performance in AWS. |
| **7** | **AWS API Gateway** (HTTP API v2) | **CONFIGURED** (SAM IaC Blueprint) | `infrastructure/template.yaml` | `tests/integration/test_frontend_screen_flows_e2e.py` | HTTP API v2 route mappings (`/`, `/{proxy+}`), CORS headers, JWT authorizer integration, and error isolation. | SAM template deployment | Deploy SAM stack; execute smoke tests against generated API Gateway endpoint URL. |
| **8** | **Amazon CloudWatch** | **LIVE_FORMATTED** | `backend/core/logging.py` | `tests/unit/test_security_hardening.py` | Structured JSON log formatter with request correlation IDs (`X-Correlation-ID`), sensitive data redaction, and metric emissions. | CloudWatch Logs agent / Lambda execution role | Stream logs to `/aws/lambda/PolicyLabBackendFunction`. |
| **9** | **AWS SAM Infrastructure** | **CONFIGURED** (IaC Blueprint) | `infrastructure/template.yaml` | Syntactic inspection & parameter validation | Complete Serverless Application Model (SAM) template defining all cloud resources with least-privilege IAM policies. | AWS SAM CLI, CloudFormation permissions | Run `sam validate` and `sam deploy --guided` in target AWS Account. |
| **10** | **Frontend Hosting** | **LOCAL_RUNNING** | `frontend/` | `npm run build` (Clean, 0 errors, 905ms) | Vite client building to `frontend/dist/`. Configured for AWS Amplify Hosting or S3/CloudFront. | Node 18+, Vite 8.3 | Deploy build bundle to AWS Amplify Hosting via git push. |

---

## 3. Operational Integrity & Security Principles

1. **No False Claims:** Integrations operating in offline simulation mode are explicitly documented as `LOCAL_MOCKED`. No mocked result is ever presented as a live cloud execution.
2. **Deterministic Primacy:** Authorization decisions, policy evaluation, diffing, counterexamples, contracts, and regression gates remain strictly deterministic and locally verifiable via Cedar WASM 4.13.0.
3. **Fail-Closed Security:** In production mode (`ENVIRONMENT=prod` or `AUTH_STRICT=true`), missing credentials or unconfigured resources fail closed with an `HTTPException` / `AWSConfigurationError` rather than fabricating access or silently passing.
4. **Digest Binding:** Human approvals are cryptographically bound to the SHA-256 hash of the exact candidate policy text. If the policy is modified after approval, submission is blocked.
