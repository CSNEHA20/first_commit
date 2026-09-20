/**
 * Test Suite: Blast Radius Graph Data Model & Transformation
 *
 * Verifies all 10 core testing requirements:
 * 1. Correct transformation of real behavioral diff data into graph nodes and edges
 * 2. Correct distinction between newly authorized, revoked, and unchanged transitions
 * 3. Correct mapping of findings to security contract indicators
 * 4. Empty analysis data handling
 * 5. Missing or malformed entity information
 * 6. Incomplete analysis responses
 * 7. Failed analysis requests & graceful fallback
 * 8. Switching candidate versions without stale graph data
 * 9. Graph interaction & detail selection payload
 * 10. Preservation of existing rubric and regression gate behavior
 */

import test from "node:test"
import assert from "node:assert/strict"
import { buildBlastRadiusGraph } from "../blastRadiusGraphModel.ts"

// Mock real Cedar diff report fixture
const mockDiffReport = {
  reportId: "diff_test_001",
  timestamp: "2026-09-20T10:00:00Z",
  engine: "cedar-wasm@4.13.0",
  baselineLabel: "v12 (Production Baseline)",
  candidateLabel: "v13 (Candidate Draft)",
  impactSummary: {
    totalScenariosDeclared: 432,
    totalScenariosCompared: 432,
    uncomparableScenariosCount: 0,
    unchangedAllowCount: 394,
    unchangedDenyCount: 0,
    newlyForbiddenCount: 11,
    newlyAuthorizedCount: 38,
    baselineExecutionErrorsCount: 0,
    candidateExecutionErrorsCount: 0,
    comparisonCoveragePct: 100,
    newlyForbiddenRatePct: 2.5,
    newlyAuthorizedRatePct: 8.8,
    unchangedRatePct: 88.7,
    deltaPrincipals: 27,
    deltaActions: 3,
    deltaResources: 18,
    affectedPrincipals: ["User::\"contractor_alice\"", "User::\"editor_bob\""],
    affectedActions: ["Action::\"delete\"", "Action::\"export\""],
    affectedResources: ["PayrollReport::\"payroll_2026_q1\"", "Invoice::\"inv_9082\""],
    isBoundedUniverse: true,
    boundaryStatement: "Analysis bounded to 432 combinations.",
  },
  scenarioDiffs: [],
  newlyAuthorizedScenarios: [],
  newlyForbiddenScenarios: [],
}

const mockCounterexamples = [
  {
    id: "cx_01",
    scenarioId: "sc_06",
    title: "Contractor can DELETE confidential Payroll Report",
    principal: "User::\"contractor_alice\"",
    action: "Action::\"delete\"",
    resource: "PayrollReport::\"payroll_2026_q1\"",
    baselineDecision: "DENY",
    candidateDecision: "ALLOW",
    transition: "DENY_TO_ALLOW",
    severity: "CRITICAL",
    severityScore: 98,
    violatedContractId: "SC-04",
    violatedContractTitle: "Contractors cannot delete payroll reports",
  },
  {
    id: "cx_03",
    scenarioId: "sc_05",
    title: "Editor can DELETE production Invoice",
    principal: "User::\"editor_bob\"",
    action: "Action::\"delete\"",
    resource: "Invoice::\"inv_9082\"",
    baselineDecision: "DENY",
    candidateDecision: "ALLOW",
    transition: "DENY_TO_ALLOW",
    severity: "HIGH",
    severityScore: 78,
    violatedContractId: "SC-03",
    violatedContractTitle: "Editors cannot delete invoices",
  },
]

const mockSecurityContracts = [
  {
    id: "SC-01",
    title: "Admin full operational access",
    severity: "CRITICAL",
    expectedDecision: "ALLOW",
    scenarioIds: ["sc_01"],
    isActive: true,
    status: "PASSED",
  },
  {
    id: "SC-03",
    title: "Editors cannot delete invoices",
    severity: "HIGH",
    expectedDecision: "DENY",
    scenarioIds: ["sc_05"],
    isActive: true,
    status: "FAILED",
  },
]

test("Requirement 1: Transforms real behavioral diff into graph nodes and edges", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
  })

  assert.ok(graph.centerNode, "Center node must exist")
  assert.equal(graph.centerNode.id, "center_policy")
  assert.equal(graph.centerNode.type, "POLICY_CENTER")
  assert.equal(graph.centerNode.status, "CONTRACT_VIOLATION")

  assert.ok(graph.nodes.length >= 7, `Expected at least 7 nodes, got ${graph.nodes.length}`)
  assert.ok(graph.edges.length >= 7, `Expected at least 7 edges, got ${graph.edges.length}`)

  // Center node must connect to all top-level clusters
  const targets = graph.edges.map((e) => e.target)
  assert.ok(targets.includes("node_devs"), "Edges should include Developers")
  assert.ok(targets.includes("node_contractors"), "Edges should include Contractors")
  assert.ok(targets.includes("node_actions"), "Edges should include Actions")
  assert.ok(targets.includes("node_resources"), "Edges should include Resources")
  assert.ok(targets.includes("node_contracts"), "Edges should include Security Contracts")
})

test("Requirement 2: Distinguishes newly authorized, revoked, and unchanged transitions", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
  })

  const newlyAuthNodes = graph.nodes.filter((n) => n.status === "NEWLY_AUTHORIZED")
  const revokedNodes = graph.nodes.filter((n) => n.status === "REVOKED")
  const modifiedNodes = graph.nodes.filter((n) => n.status === "MODIFIED_AFFECTED")
  const contractNodes = graph.nodes.filter((n) => n.status === "CONTRACT_VIOLATION")

  assert.ok(newlyAuthNodes.length > 0, "Should contain newly authorized nodes")
  assert.ok(revokedNodes.length > 0, "Should contain revoked nodes")
  assert.ok(modifiedNodes.length > 0, "Should contain modified/affected nodes")
  assert.ok(contractNodes.length > 0, "Should contain contract violation nodes")

  // Check edge status classification
  const newlyAuthEdges = graph.edges.filter((e) => e.status === "NEWLY_AUTHORIZED")
  const revokedEdges = graph.edges.filter((e) => e.status === "REVOKED")

  assert.ok(newlyAuthEdges.length > 0, "Should contain newly authorized edges")
  assert.ok(revokedEdges.length > 0, "Should contain revoked edges")
})

test("Requirement 3: Maps findings to security contract indicators", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
    fallbackContracts: mockSecurityContracts,
  })

  const contractNode = graph.nodes.find((n) => n.id === "node_contracts")
  assert.ok(contractNode, "Security contract node must exist")
  assert.equal(contractNode.status, "CONTRACT_VIOLATION")
  assert.equal(contractNode.details.violatedContractId, "SC-03")
  assert.equal(contractNode.details.counterexampleId, "cx_01")
  assert.equal(contractNode.count, 2) // 2 violating counterexamples
})

test("Requirement 4: Gracefully handles empty analysis data", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: null,
    counterexamples: [],
  })

  assert.ok(graph.centerNode, "Center node must still exist with empty data")
  assert.ok(graph.nodes.length > 0, "Nodes should default to bounded fixture values")
  assert.ok(graph.stats.totalScenariosEvaluated > 0, "Universe size should default accurately")
  assert.equal(graph.gateStatus, "BLOCKED")
})

test("Requirement 5: Handles missing or malformed entity information", () => {
  const malformedDiff = {
    ...mockDiffReport,
    impactSummary: {
      ...mockDiffReport.impactSummary,
      affectedPrincipals: undefined,
      affectedActions: null,
      affectedResources: [],
    },
  }

  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: malformedDiff,
    counterexamples: [
      {
        id: "cx_malformed",
        scenarioId: "sc_99",
        principal: "",
        action: "",
        resource: "",
        baselineDecision: "DENY",
        candidateDecision: "ALLOW",
        transition: "NEWLY_AUTHORIZED",
      },
    ],
  })

  assert.ok(graph.centerNode)
  assert.ok(graph.stats)
  assert.equal(graph.isBlocked, true)
})

test("Requirement 6: Handles incomplete analysis responses", () => {
  const incompleteDiff = {
    reportId: "diff_incomplete",
    timestamp: "2026-09-20T10:00:00Z",
    engine: "cedar-wasm@4.13.0",
    baselineLabel: "v12",
    candidateLabel: "v13",
    impactSummary: {
      totalScenariosDeclared: 432,
      totalScenariosCompared: 200, // Incomplete comparison
      uncomparableScenariosCount: 232,
      unchangedAllowCount: 150,
      unchangedDenyCount: 0,
      newlyForbiddenCount: 0,
      newlyAuthorizedCount: 50,
      baselineExecutionErrorsCount: 0,
      candidateExecutionErrorsCount: 0,
      comparisonCoveragePct: 46.3,
      newlyForbiddenRatePct: 0,
      newlyAuthorizedRatePct: 25.0,
      unchangedRatePct: 75.0,
      deltaPrincipals: 10,
      deltaActions: 2,
      deltaResources: 8,
      affectedPrincipals: [],
      affectedActions: [],
      affectedResources: [],
      isBoundedUniverse: true,
      boundaryStatement: "Partial coverage.",
    },
    scenarioDiffs: [],
    newlyAuthorizedScenarios: [],
    newlyForbiddenScenarios: [],
  }

  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: incompleteDiff,
  })

  assert.equal(graph.stats.coveragePct, 46.3)
  assert.equal(graph.stats.totalScenariosEvaluated, 200)
  assert.equal(graph.isBlocked, true)
})

test("Requirement 7: Failed analysis requests fallback to safe boundary guarantees", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: null,
    counterexamples: [],
    fallbackImpact: undefined,
  })

  assert.ok(graph.boundaryStatement.includes("strictly bounded"))
  assert.equal(graph.gateStatus, "BLOCKED")
})

test("Requirement 8: Switching candidate versions produces clean graph without stale state", () => {
  // 1. Evaluate v13 (Draft Bug)
  const graphV13 = buildBlastRadiusGraph({
    candidateVersion: "v13",
    candidateLabel: "v13 (Draft)",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
  })

  assert.equal(graphV13.isBlocked, true)
  assert.equal(graphV13.gateStatus, "BLOCKED")
  assert.equal(graphV13.centerNode.label, "v13 (Draft)")
  assert.equal(graphV13.centerNode.status, "CONTRACT_VIOLATION")
  assert.equal(graphV13.stats.riskScore, 88) // Average of 98 & 78

  // 2. Evaluate v13_fixed (Clean Fix)
  const graphV13Fixed = buildBlastRadiusGraph({
    candidateVersion: "v13_fixed",
    candidateLabel: "v13 (Fixed)",
    diffReport: null,
    counterexamples: [],
  })

  assert.equal(graphV13Fixed.isBlocked, false)
  assert.equal(graphV13Fixed.gateStatus, "PASS")
  assert.equal(graphV13Fixed.centerNode.label, "v13 (Fixed)")
  assert.equal(graphV13Fixed.centerNode.status, "SAFE")
  assert.equal(graphV13Fixed.stats.riskScore, 0)
  assert.equal(graphV13Fixed.stats.newlyAuthorizedCount, 0)
  assert.equal(graphV13Fixed.stats.contractViolationsCount, 0)

  // Verify that fixed topology contains no violation nodes
  const violationNodes = graphV13Fixed.nodes.filter((n) => n.status === "CONTRACT_VIOLATION")
  assert.equal(violationNodes.length, 0, "v13_fixed must not retain stale violation nodes")
})

test("Requirement 9: Graph nodes contain full inspection details payload", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
  })

  const contractorNode = graph.nodes.find((n) => n.id === "node_contractors")
  assert.ok(contractorNode)
  assert.ok(contractorNode.details.title)
  assert.ok(contractorNode.details.description)
  assert.ok(contractorNode.details.principals.includes("User::\"contractor_alice\""))
  assert.ok(contractorNode.details.transitions.length > 0)
  assert.equal(contractorNode.details.transitions[0].from, "DENY")
  assert.equal(contractorNode.details.transitions[0].to, "ALLOW")
})

test("Requirement 10: Preserves existing rubric and regression gate behavior", () => {
  const graph = buildBlastRadiusGraph({
    candidateVersion: "v13",
    diffReport: mockDiffReport,
    counterexamples: mockCounterexamples,
  })

  // Preserves 100-point rubric
  assert.ok(graph.stats.riskScore >= 78 && graph.stats.riskScore <= 100)
  assert.equal(graph.stats.riskLevel, "HIGH")
  assert.equal(graph.stats.potentialFinancialImpact, "High (requires review)")

  // Preserves regression gate blocking rule
  assert.equal(graph.isBlocked, true)
  assert.equal(graph.gateStatus, "BLOCKED")
})
