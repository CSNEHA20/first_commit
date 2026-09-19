# PolicyLab — AWS Deployment, Verification & Teardown Guide
## Phase 9 Final Deliverable | WeMakeDevs × AWS First Commit 2026

**Product:** PolicyLab — Authorization Verification & Policy Engineering Platform  
**Team:** VibeSync (Vishal Lakshmikanthan & Sneha C.)  
**Document Version:** 1.0.0  
**Date:** 2026-09-19  

---

## 1. Cloud Architecture Overview

PolicyLab deploys on AWS as a 100% serverless, zero-idle-cost application designed to operate comfortably within an allocated budget of **~$100 in AWS promotional credits**:

```text
                                 ┌────────────────────────────────────────────────┐
                                 │                 AWS Cloud                      │
                                 │                                                │
[React 18+ Client] ────────────► │ [Amazon API Gateway (HTTP API v2)]             │
(Amplify / S3+CloudFront)        │                        │                       │
                                 │                        ▼                       │
                                 │            [AWS Lambda (FastAPI / Mangum)]     │
                                 │                        │                       │
                                 │    ┌───────────────────┼──────────────────┐    │
                                 │    ▼                   ▼                  ▼    │
                                 │ [Amazon DynamoDB]  [Amazon S3]   [Amazon AVP]  │
                                 │ (Single-Table)    (Artifacts)    (Policy Store)│
                                 │                        ▲                       │
                                 │                        │                       │
                                 │             [AWS Step Functions]               │
                                 │             (Async Audit Flow)                 │
                                 │                                                │
                                 │             [Amazon Bedrock]                   │
                                 │             (Claude 3.5 Sonnet)                │
                                 └────────────────────────────────────────────────┘
```

---

## 2. Prerequisites & Tooling

To deploy and execute live verifications against AWS:
1. **AWS Account:** With active billing or hackathon promotional credits ($100).
2. **AWS CLI v2:** Installed and configured (`aws configure` with access key and secret).
3. **AWS SAM CLI:** Installed (`sam --version` >= 1.100.0).
4. **Python 3.11+:** For backend packaging.
5. **Node.js 18+:** For frontend build.
6. **Amazon Bedrock Entitlement:** Request Anthropic Claude 3.5 Sonnet (`anthropic.claude-3-5-sonnet-20241022-v2:0`) model access in `us-east-1` via the AWS Bedrock Console.

---

## 3. Serverless Deployment via AWS SAM

### Step 1: Clone and Prepare Workspace
```bash
git clone https://github.com/Vishallakshmikanthan/policylab.git
cd policylab
```

### Step 2: Validate SAM Template
```bash
sam validate -t infrastructure/template.yaml
```

### Step 3: Build the Serverless Application
```bash
sam build -t infrastructure/template.yaml
```

### Step 4: Guided Deployment
```bash
sam deploy --guided \
  --stack-name policylab-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM
```

During guided deployment, provide:
- **Stack Name:** `policylab-prod`
- **AWS Region:** `us-east-1`
- **Parameter Environment:** `prod`
- **Parameter StrictAWS:** `true`
- **Confirm changes before deploy:** `Y`
- **Allow SAM CLI to create IAM roles:** `Y`
- **Save arguments to configuration file:** `Y`

### SAM Template Outputs
Upon successful deployment, SAM outputs:
- `ApiUrl`: The public API Gateway HTTPS base URL.
- `DynamoDBTableName`: `policylab-metadata-prod`
- `S3BucketName`: `policylab-artifacts-<account-id>-us-east-1-prod`
- `StepFunctionArn`: `arn:aws:states:us-east-1:<account-id>:stateMachine:PolicyLabAuditWorkflow-prod`

---

## 4. Environment Variables Configuration

When running backend services in production or local live mode, configure these environment variables:

| Variable Name | Required in Prod | Default (Dev) | Description |
| :--- | :---: | :---: | :--- |
| `ENVIRONMENT` | Yes | `dev` | Application environment (`dev`, `staging`, `prod`). |
| `STRICT_AWS` | Yes | `false` | When `true`, missing credentials raise `AWSConfigurationError` (fail-closed). |
| `AWS_REGION` | Yes | `us-east-1` | Target AWS region. |
| `AWS_AVP_ENABLED` | Yes | `false` | Enable live Amazon Verified Permissions integration. |
| `AVP_POLICY_STORE_ID` | Yes | `ps-acmepay-prod`| Amazon Verified Permissions policy store ID. |
| `AWS_BEDROCK_ENABLED` | Yes | `false` | Enable live Amazon Bedrock AI explanation service. |
| `BEDROCK_MODEL_ID` | Optional | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model ID. |
| `AWS_DYNAMODB_ENABLED`| Yes | `false` | Enable live Amazon DynamoDB single-table persistence. |
| `POLICYLAB_DYNAMODB_TABLE` | Yes | `policylab-metadata-prod` | DynamoDB table name. |
| `AWS_S3_ENABLED` | Yes | `false` | Enable live Amazon S3 artifact storage. |
| `POLICYLAB_ARTIFACT_BUCKET` | Yes | `policylab-artifacts-prod` | S3 artifact bucket name. |
| `AWS_STEP_FUNCTIONS_ENABLED` | Optional | `false` | Enable AWS Step Functions audit orchestration. |
| `AUDIT_STATE_MACHINE_ARN` | Optional | None | Step Functions state machine ARN. |

---

## 5. Live Cloud Verification Runbook

### 1. Verify Operational Health & AWS Status
```bash
curl -X GET "https://<api-id>.execute-api.us-east-1.amazonaws.com/health"
curl -X GET "https://<api-id>.execute-api.us-east-1.amazonaws.com/aws/status"
```
*Expected Result:* HTTP 200 with all 5 services reporting `status: LIVE` when credentials and resources are active.

### 2. Verify Amazon Verified Permissions Store Discovery
```bash
aws verifiedpermissions get-policy-store \
  --policy-store-id ps-acmepay-prod \
  --region us-east-1
```
*Expected Result:* Returns policy store metadata with `createdDate`.

### 3. Verify Amazon Bedrock Explanation Call
```bash
curl -X POST "https://<api-id>.execute-api.us-east-1.amazonaws.com/explanations" \
  -H "Content-Type: application/json" \
  -d '{
    "findingId": "cx_sc_05",
    "scenarioId": "sc_05",
    "scenarioTitle": "Editor Invoice Deletion Prohibited",
    "principal": "Role::\"editor\"",
    "action": "Action::\"delete\"",
    "resource": "ResourceType::\"Invoice\"",
    "context": {},
    "baselineDecision": "DENY",
    "candidateDecision": "ALLOW",
    "transition": "NEWLY_AUTHORIZED",
    "determiningPolicies": ["candidate_policy_01"],
    "violatedContractId": "SC-03",
    "violatedContractTitle": "Editor Invoice Deletion Prohibited",
    "regressionRunId": "reg_live_01"
  }'
```
*Expected Result:* Returns structured JSON explanation with verified citation `cx_sc_05`.

### 4. Verify Verified Permissions Deployment Gate
```bash
# 1. Prepare deployment
curl -X POST "https://<api-id>.execute-api.us-east-1.amazonaws.com/deployment/prepare" \
  -H "Content-Type: application/json" \
  -d '{
    "candidatePolicyText": "permit(principal in Role::\"editor\", action == Action::\"view\", resource in ResourceType::\"Invoice\");",
    "targetStoreId": "ps-acmepay-prod",
    "environment": "production",
    "regressionReport": {
      "runId": "reg_live_02",
      "gateDecision": {
        "status": "PASS",
        "isPassing": true,
        "blockingViolationsCount": 0,
        "reasons": ["All contracts satisfied"]
      }
    }
  }'
```

---

## 6. Cost Discipline & Guardrails

PolicyLab was architected specifically to conserve hackathon credits:
1. **Pay-Per-Request DynamoDB:** Zero cost when not actively processing queries.
2. **Standard S3 Storage:** Less than 10MB of Cedar policies, costing <$0.01/month.
3. **Claude 3.5 Token Bounding:** Explanations enforce `max_tokens: 800` with temperature `0.0`.
4. **CloudWatch Log Capping:** Logs are retained for 7 days maximum.
5. **No Long-Running Infrastructure:** No EC2, NAT Gateways, RDS, or provisioned clusters.

**Total Projected Testing Cost:** **$2.50 – $5.00** of the ~$100 credit budget.

---

## 7. Teardown & Resource Cleanup

To completely remove all cloud resources and prevent charges after evaluation:

```bash
# 1. Delete the CloudFormation stack via SAM CLI
sam delete --stack-name policylab-prod --region us-east-1 --no-prompts

# 2. Empty and remove the S3 artifact bucket (if retained by Retain policy)
aws s3 rm s3://policylab-artifacts-<account-id>-us-east-1-prod --recursive
aws s3 rb s3://policylab-artifacts-<account-id>-us-east-1-prod

# 3. Delete the AVP policy store (if created manually)
aws verifiedpermissions delete-policy-store \
  --policy-store-id ps-acmepay-prod \
  --region us-east-1

# 4. Confirm stack deletion
aws cloudformation describe-stacks \
  --stack-name policylab-prod \
  --region us-east-1
# Expected output: Stack with id policylab-prod does not exist
```
