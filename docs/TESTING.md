# PolicyLab — Verification & Testing Guide
## WeMakeDevs × AWS First Commit 2026 | Team VibeSync

---

# 1. Testing Philosophy

At PolicyLab, **testing is an architectural deliverable, not an optional aftermath**.
Our testing pyramid guarantees:
1. **100% Deterministic Authorization Truth:** Cedar evaluation and diff classification never rely on probabilistic models or external network state.
2. **Fail-Closed Integrity:** Validation failures, missing entities, malformed graphs, and provider exceptions are proven to never yield false `ALLOW` results.
3. **Multi-Stage Verification:** Input validation, policy diffs, counterexamples, security contracts, regression gates, and human approval are each individually verified.

---

# 2. Test Taxonomy

PolicyLab organizes tests into four rigorous tiers:

### Tier 1: Unit Tests (`tests/unit/`)
* **`test_cedar_validation.py`**: Validates Cedar policy syntax parsing, empty policies, schema constraints, and source locations.
* **`test_cedar_evaluation.py`**: Verifies permit/forbid semantics, determining policies, and diagnostics.
* **`test_scenario_runner.py`**: Verifies deterministic scenario suite execution, duplicate ID detection, and error handling.
* **`test_policy_diff.py`**: Tests behavioral transition classification (`UNCHANGED_ALLOW`, `UNCHANGED_DENY`, `NEWLY_AUTHORIZED`, `NEWLY_FORBIDDEN`).
* **`test_counterexamples.py`**: Tests extraction of concrete counterexample tuples and replay reproducibility.
* **`test_security_contracts.py`**: Verifies contract evaluation (`INVARIANT_PERMITTED`, `INVARIANT_FORBIDDEN`) under baseline and candidate policies.
* **`test_regression_engine.py`**: Tests pre-deployment gate calculation (`PASS`, `BLOCKED`, `INCOMPLETE`).
* **`test_entity_provider.py`**: Tests `IEntityProvider`, `FixtureEntityProvider`, bounded `EntitySnapshot` creation, SHA-256 integrity verification, and cache clearing.
* **`test_persistence_adapters.py`**: Tests in-memory repository, stored provider, DynamoDB fallback, and S3 artifact repository.
* **`test_input_validation.py`**: Tests multi-stage input validation boundary and `EnforcedEvaluationPipeline`.
* **`test_ai_explanation.py`**: Verifies citation filtering, grounded explanations, and prompt injection containment.
* **`test_avp_adapter.py`**: Tests readiness checks, deployment preparation, cryptographic hash calculation, and human approval validation.
* **`test_security_hardening.py`**: Tests payload limits (size, scenarios, entities) and candidate tampering rejection.

### Tier 2: API Integration Tests (`tests/integration/`)
* **`test_api.py`**: Core REST API tests (health, policy validation, single evaluation).
* **`test_batch_api.py`**: Batch simulation API tests.
* **`test_diff_api.py`**: Semantic policy diff API tests.
* **`test_regression_api.py`**: Counterexample replay, contracts evaluation, and regression API tests.
* **`test_phase5_api.py`**: Grounded AI explanation, AVP readiness, prepare, approve, and submit workflow tests.
* **`test_phase7_api.py`**: Multi-stage validation, NL policy generator, Strands audit agent, report export, access matrix, what-if simulator, version timeline, and snapshot management APIs.

### Tier 3: End-to-End Demonstration (`tests/integration/`)
* **`test_acmepay_e2e_regression.py`**: 12-step AcmePay regression demonstration.
* **`test_acmepay_e2e_full_lifecycle.py`**: 17-step full lifecycle demonstration from baseline v12 to regression detection, counterexample extraction, contract violation, policy fix, revalidation, and verified deployment.

---

# 3. Executing the Test Suites

### Run All Tests
```bash
& ".\backend\.venv\Scripts\pytest.exe" -v
```

### Run Focused Unit Tests
```bash
& ".\backend\.venv\Scripts\pytest.exe" tests/unit/ -v
```

### Run Focused Integration Tests
```bash
& ".\backend\.venv\Scripts\pytest.exe" tests/integration/ -v
```

### Run Security Hardening Tests
```bash
& ".\backend\.venv\Scripts\pytest.exe" tests/unit/test_security_hardening.py -v
```

### Run Full AcmePay End-to-End Lifecycle Demonstration
```bash
& ".\backend\.venv\Scripts\pytest.exe" tests/integration/test_acmepay_e2e_full_lifecycle.py -v -s
```

### Frontend Typecheck & Production Build Validation
```bash
cd frontend
npm run build
```
