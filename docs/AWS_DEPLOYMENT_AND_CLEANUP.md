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
(Amplify / S3+CloudFront)        │    │ (DefaultAuthorizer: CognitoJwtAuthorizer) │
       │                         │    │                                           │
       │ (Auth: Cognito Token)   │    ├──► [Amazon Cognito User Pool]             │
       └─────────────────────────┼────┘    (AuthN & Role Groups)                  │
                                 │    │                                           │
                                 │    ▼                                           │
                                 │ [AWS Lambda (FastAPI / Mangum)]                │
                                 │    │ (Strict Claims Extraction & RBAC)         │
                                 │    │                                           │
                                 │    ├───────────────────┼──────────────────┐    │
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
sam validate --template-file infrastructure/template.yaml --region us-east-1
```

### Step 3: Build the Serverless Application
The template specifies `CodeUri: ../backend` and uses SAM's native `ParentPackageMode: explicit` (`ParentPackages: backend`). This ensures all pip dependencies from `backend/requirements.txt` are bundled while preserving the `backend.lambda_handler.handler` package structure and excluding `frontend/node_modules/`:
```bash
sam build --template-file infrastructure/template.yaml --region us-east-1
```

### Step 4: Guided Deployment & Security Configuration

The SAM template provisions a fully self-contained authentication architecture:
- **`PolicyLabUserPool`**: Amazon Cognito User Pool with strict password policies and self-service registration controls.
- **`PolicyLabUserPoolClient`**: Web App client (PKCE-ready, secretless for browser SPAs).
- **`CognitoJwtAuthorizer`**: API Gateway HTTP API v2 Default Authorizer that cryptographically verifies JWT signature, issuer, audience, and expiration at the edge before traffic touches Lambda.
- **Fail-Closed Backend Trust Boundary**: In production (`ENVIRONMENT=prod` or `AUTH_STRICT=true`), the Lambda backend trusts only claims forwarded through the verified API Gateway authorizer context (`requestContext.authorizer.jwt.claims`). Standalone unverified Bearer tokens fail closed with HTTP 401.
- **Least-Privilege RBAC**: Unassigned users safely default to `viewer` (read-only least privilege). Mutation and deployment actions enforce server-side role checks (`engineer`, `approver`, `deployer`, `admin`).
- **Public Exemption**: Only `GET /health` has `Authorizer: NONE` for synthetic uptime checks.

```bash
sam deploy --guided \
  --template-file infrastructure/template.yaml \
  --stack-name policylab-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM
```

During guided deployment, provide:
- **Stack Name:** `policylab-prod`
- **AWS Region:** `us-east-1`
- **Parameter EnvironmentName:** `prod`
- **Parameter AVPPolicyStoreId:** `ps-acmepay-prod`
- **Parameter FrontendOrigin:** Your deployed frontend URL (e.g. `https://main.d123456.amplifyapp.com` or `http://localhost:5173`)
- **Confirm changes before deploy:** `Y`
- **Allow SAM CLI to create IAM roles:** `Y`
- **Save arguments to configuration file:** `Y`

### SAM Template Outputs
Upon successful deployment, SAM outputs:
- `ApiEndpoint`: The HTTP API Gateway HTTPS base URL.
- `UserPoolId`: Amazon Cognito User Pool ID (`us-east-1_xxxxxxxxx`).
- `UserPoolClientId`: Amazon Cognito Web App Client ID.
- `CognitoAuthUrl`: Identity Provider Issuer URL (`https://cognito-idp.us-east-1.amazonaws.com/<user-pool-id>`).
- `DynamoDBTableName`: `PolicyLab-prod`
- `ArtifactsBucketName`: `policylab-artifacts-<account-id>-us-east-1-prod`
- `StateMachineArn`: `arn:aws:states:us-east-1:<account-id>:stateMachine:PolicyAuditWorkflow-prod`
- `BackendFunctionArn`: `arn:aws:lambda:us-east-1:<account-id>:function:policylab-prod-PolicyLabBackendFunction-...`

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

## 5. Amazon Cognito Identity & RBAC Configuration

PolicyLab implements Role-Based Access Control (RBAC) enforced at the application layer with identity provenance verified by the API Gateway Cognito JWT Authorizer:

### Platform Authorization Roles

| Role | Permitted Actions | Target Endpoints |
| :--- | :--- | :--- |
| `viewer` | Read-only inspection of status, history, timelines, and metrics | `GET /aws/status`, `GET /deployment/history`, `GET /policies/{set_id}/timeline` |
| `engineer` | Policy authoring, syntax validation, what-if simulations, and diffs | `POST /policies/validate`, `POST /simulate`, `POST /simulator/what-if`, `POST /diff` |
| `approver` | Pre-deployment gate inspection and cryptographic approval issuance | `POST /deployment/prepare`, `POST /deployment/approve` |
| `deployer` | Initiates synchronized policy deployment to Amazon Verified Permissions | `POST /deployment/submit` |
| `admin` | Universal administrative access and full bypass capabilities | All endpoints |

### Creating a User and Assigning Role Groups via AWS CLI

```bash
# 1. Create a SecOps Approver User in the deployed User Pool
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username sarah.chen@acmepay.internal \
  --user-attributes Email=sarah.chen@acmepay.internal,EmailVerified=true \
  --temporary-password "TemporaryP@ss123!"

# 2. Create the 'approver' group (if not created automatically)
aws cognito-idp create-group \
  --user-pool-id <UserPoolId> \
  --group-name approver \
  --description "SecOps Authorized Approvers"

# 3. Add user to the 'approver' group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <UserPoolId> \
  --username sarah.chen@acmepay.internal \
  --group-name approver

# 4. Authenticate and retrieve ID Token (JWT)
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <UserPoolClientId> \
  --auth-parameters USERNAME=sarah.chen@acmepay.internal,PASSWORD="PermanentP@ss456!"
```

---

## 6. Live Cloud Verification Runbook

### 1. Verify Operational Health (Public) & AWS Status (Authenticated)
```bash
# Unauthenticated health probe (always public)
curl -X GET "https://<api-id>.execute-api.us-east-1.amazonaws.com/health"

# Authenticated status check
curl -X GET "https://<api-id>.execute-api.us-east-1.amazonaws.com/aws/status" \
  -H "Authorization: Bearer <IdToken>"
```
*Expected Result:* HTTP 200 with all 5 services reporting `status: LIVE` when credentials and resources are active. Unauthenticated requests to `/aws/status` return HTTP 401 Unauthorized.

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
