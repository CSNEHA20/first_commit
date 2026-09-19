# PolicyLab — Deployment & AWS Infrastructure Guide
## WeMakeDevs × AWS First Commit 2026 | Team VibeSync

---

# 1. Overview

PolicyLab is architected for dual-mode execution:
1. **Local Deterministic Development & Testing:** 100% offline, zero-cloud-spend execution via Node.js WASM bridge and in-memory/fixture adapters.
2. **AWS Serverless Production:** AWS SAM template provisioning API Gateway, AWS Lambda (Python 3.11 with Mangum), Amazon DynamoDB, Amazon S3, Amazon Bedrock (Claude 3.5 Sonnet), and Amazon Verified Permissions (AVP).

---

# 2. Prerequisites

### Local Development
* **Python:** 3.11+
* **Node.js:** v18+ (with `@cedar-policy/cedar-wasm` installed in root `node_modules`)
* **Package Managers:** `pip`, `npm`

### AWS Deployment
* **AWS CLI:** Configured with valid IAM credentials (`aws configure`)
* **AWS SAM CLI:** Installed (`sam --version`)
* **Amazon Bedrock Model Access:** Model access granted in target region (e.g. `us-east-1`) for `anthropic.claude-3-5-sonnet-20240620-v1:0`
* **Amazon Verified Permissions:** Target policy store created (e.g. `ps-acmepay-prod`) or permission to create one.

---

# 3. Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `AWS_REGION` | Target AWS deployment region | `us-east-1` |
| `AWS_BEDROCK_ENABLED` | Set to `"true"` to enable live Amazon Bedrock API calls | `"false"` (falls back to deterministic templates) |
| `AWS_AVP_ENABLED` | Set to `"true"` to enable live Amazon Verified Permissions sync | `"false"` (falls back to deterministic fake adapter) |
| `AWS_DYNAMODB_ENABLED` | Set to `"true"` to persist to live DynamoDB tables | `"false"` (falls back to in-memory repository) |
| `AWS_S3_ENABLED` | Set to `"true"` to store artifacts in live S3 bucket | `"false"` (falls back to local memory/filesystem) |
| `POLICYLAB_DYNAMODB_TABLE` | Target DynamoDB single-table name | `PolicyLab-prod` |
| `POLICYLAB_ARTIFACT_BUCKET` | Target S3 bucket name for immutable evidence | `policylab-artifacts-<account>-<region>-prod` |

---

# 4. Local Execution Commands

### 1. Start Backend API
```bash
# From workspace root
& ".\backend\.venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be accessible at `http://localhost:8000/docs`.

### 2. Start Frontend Development Server
```bash
cd frontend
npm run dev
```
Frontend workstation will be accessible at `http://localhost:5173`.

---

# 5. AWS SAM Cloud Deployment

### 1. Validate SAM Template
```bash
cd infrastructure
sam validate --lint
```

### 2. Build SAM Application
```bash
sam build --template template.yaml
```

### 3. Deploy to AWS
```bash
sam deploy --guided \
  --stack-name policylab-serverless-prod \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region us-east-1 \
  --parameter-overrides EnvironmentName=prod AVPPolicyStoreId=ps-acmepay-prod
```

### 4. Verify Remote Deployment
```bash
# Check health
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/health

# Check AVP readiness
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/deployment/readiness
```

---

# 6. Least-Privilege IAM Policy Specifications

PolicyLab runtime requires only the following scoped IAM actions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:*:*:foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0"
    },
    {
      "Sid": "VerifiedPermissionsAccess",
      "Effect": "Allow",
      "Action": [
        "verifiedpermissions:GetPolicyStore",
        "verifiedpermissions:GetPolicy",
        "verifiedpermissions:CreatePolicy",
        "verifiedpermissions:UpdatePolicy",
        "verifiedpermissions:IsAuthorized"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBCrud",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/PolicyLab-*"
    },
    {
      "Sid": "S3ArtifactsCrud",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::policylab-artifacts-*",
        "arn:aws:s3:::policylab-artifacts-*/*"
      ]
    }
  ]
}
```
