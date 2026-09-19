# PolicyLab — AWS Cost Management, Guardrails & Cleanup Guide
## WeMakeDevs × AWS First Commit 2026 | Team VibeSync

---

# 1. AWS Credit Allocation & Cost Architecture

PolicyLab operates under an allocated budget of **~$100 in AWS promotional credits**.
To maximize judging impact while ensuring zero budget overruns, PolicyLab enforces strict serverless cost controls:

### Pricing Model Breakdown

| AWS Service | Architecture Role | Pricing Tier | Estimated Hackathon Cost |
| :--- | :--- | :--- | :--- |
| **AWS Lambda** | FastAPI Backend Execution | Free Tier: 1M requests/mo | **$0.00** |
| **Amazon API Gateway** | HTTP API v2 | $1.00 / 1M calls | **<$0.05** |
| **Amazon DynamoDB** | Single-table persistence | On-Demand (Pay per request) | **<$0.10** |
| **Amazon S3** | Cedar policy & schema artifacts | Standard Storage (<10 MB) | **<$0.01** |
| **Amazon Bedrock** | Anthropic Claude 3.5 Sonnet | $3 / 1M input tokens, $15 / 1M output | **$2.00 – $5.00** |
| **Amazon Verified Permissions**| Production policy store & evaluation | $40 / 1M authz requests | **<$0.50** |
| **AWS Step Functions** | Express / Standard Audit Workflows | First 4,000 state transitions free | **$0.00** |
| **Amazon CloudWatch** | Structured JSON Logs (Retention: 7 days) | Free Tier: 5 GB ingestion | **$0.00** |

**Total Estimated Evaluation Cost:** **$2.65 – $5.65** (Consuming <6% of available credits).

---

# 2. Cost Guardrails & Anti-Waste Policies

1. **Deterministic Local Fallback:** By default, PolicyLab runs in offline deterministic mode with zero external network or AWS API calls. AWS services are activated only when explicitly configured via environment variables.
2. **Anthropic Claude Token Bounding:** All Bedrock prompt invocations enforce `max_tokens: 800-1000` with temperature `0.0`. Prompt payloads are strictly limited to necessary structured evidence facts.
3. **No Expensive Persistent Idle Resources:** Zero NAT Gateways, zero always-on EC2 instances, zero provisioned IOPS, and zero OpenSearch clusters.
4. **Pay-Per-Request DynamoDB:** DynamoDB tables use `BillingMode: PAY_PER_REQUEST` so zero charges accrue when idle.
5. **Log Retention Capping:** CloudWatch log groups are configured with a 7-day retention period to prevent unbounded storage costs.

---

# 3. AWS Resource Teardown & Cleanup Instructions

When evaluation or demonstration is finished, destroy all provisioned AWS cloud resources using the standard commands below:

### 1. Delete AWS SAM CloudFormation Stack
```bash
sam delete --stack-name policylab-serverless-prod --region us-east-1 --no-prompts
```

### 2. Empty and Delete S3 Artifact Bucket
```bash
# Replace with actual account ID and region
aws s3 rm s3://policylab-artifacts-<account-id>-us-east-1-prod --recursive
aws s3 rb s3://policylab-artifacts-<account-id>-us-east-1-prod
```

### 3. Delete Amazon Verified Permissions Policy Store
```bash
aws verifiedpermissions delete-policy-store --policy-store-id ps-acmepay-prod --region us-east-1
```

### 4. Verify Resource Deletion
```bash
# Verify stack deletion
aws cloudformation describe-stacks --stack-name policylab-serverless-prod --region us-east-1
# Expected output: Stack does not exist
```
