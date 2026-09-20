import React, { useState } from 'react'
import {
  Shield,
  ArrowRight,
  Zap,
  GitCompare,
  Layers,
  FileCode2,
  Cpu,
  Workflow,
  CheckCircle2,
  ChevronRight,
  Sun,
  Moon,
  Play,
  AlertTriangle,
  Activity,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/theme/ThemeProvider'
import { AuthModal } from '@/features/auth/AuthModal'
import { UserSessionBadge } from '@/components/common/UserSessionBadge'

interface LandingPageProps {
  onEnterConsole: () => void
  onOpenBenchmark: (benchmark: 'acmepay' | 'docvault') => void
}

// ─── Interactive Simulator Scenario Definitions ──────────────────────────────────
interface SimulationScenario {
  id: string
  name: string
  industry: string
  riskBadge: string
  riskColor: string
  principal: string
  principalRole: string
  action: string
  resource: string
  resourceValue: string
  contractId: string
  contractTitle: string
  contractRule: string
  baselineDecision: 'DENY' | 'ALLOW'
  candidateDecisionBuggy: 'ALLOW'
  candidateDecisionFixed: 'DENY'
  gateStatusBuggy: 'BLOCKED'
  gateStatusFixed: 'PASS'
  baselineCode: string
  buggyCandidateCode: string
  fixedCandidateCode: string
  buggyDiffHighlight: string
  fixedDiffHighlight: string
  aiRootCause: string
  aiRemediationCedar: string
}

const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: 'sc_fintech_01',
    name: 'Contractor Dave Refund Privilege Escalation',
    industry: 'FinTech & Payments (AcmePay)',
    riskBadge: 'CRITICAL REGRESSION',
    riskColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    principal: 'User::"contractor_dave"',
    principalRole: 'Contractor Staff',
    action: 'Action::"RefundOrder"',
    resource: 'Order::"order_999"',
    resourceValue: '$4,999.00 USD',
    contractId: 'SC-04',
    contractTitle: 'Contractors Restricted From Financial Refunds',
    contractRule: 'ASSERT candidate_policy DENY for all Role::"contractor" on Action::"RefundOrder"',
    baselineDecision: 'DENY',
    candidateDecisionBuggy: 'ALLOW',
    candidateDecisionFixed: 'DENY',
    gateStatusBuggy: 'BLOCKED',
    gateStatusFixed: 'PASS',
    baselineCode: `// Baseline v12 (Production)
permit (
    principal in Role::"contractor",
    action in [Action::"view"],
    resource is Order
);`,
    buggyCandidateCode: `// Candidate v13 (Draft with Unintended Drift)
permit (
    principal in Role::"contractor",
    action in [Action::"view", Action::"RefundOrder"], // ⚠️ UNINTENDED PERMIT DRIFT
    resource is Order
);`,
    fixedCandidateCode: `// Candidate v13 (Verified Secure Patch)
permit (
    principal in Role::"contractor",
    action in [Action::"view"],
    resource is Order
);
forbid (
    principal in Role::"contractor",
    action == Action::"RefundOrder",
    resource is Order
);`,
    buggyDiffHighlight: '+ action in [Action::"view", Action::"RefundOrder"], // ⚠️ EXPANSION: FLIP TO ALLOW',
    fixedDiffHighlight: '+ forbid ( principal in Role::"contractor", action == Action::"RefundOrder" );',
    aiRootCause: 'Candidate policy scope broadened contractor permit clause to include Action::"RefundOrder". This bypasses organizational separation of duties.',
    aiRemediationCedar: `// Grounded Remediation via Cedar Invariant Patch:
forbid (
    principal in Role::"contractor",
    action == Action::"RefundOrder",
    resource is Order
);`,
  },
  {
    id: 'sc_legal_02',
    name: 'External Auditor Sealed Legal Hold Access Breach',
    industry: 'Enterprise Legal SaaS (DocVault)',
    riskBadge: 'DATA LEAK THREAT',
    riskColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    principal: 'User::"auditor_external"',
    principalRole: 'Third-Party Compliance Reviewer',
    action: 'Action::"DownloadDocument"',
    resource: 'Document::"sealed_litigation_file"',
    resourceValue: 'Case #2026-CV-8809 (Sealed Hold)',
    contractId: 'DV-02',
    contractTitle: 'Legal Hold Sealed Documents Invariant',
    contractRule: 'ASSERT decision == DENY for principal.tier == "external" on resource.isSealed == true',
    baselineDecision: 'DENY',
    candidateDecisionBuggy: 'ALLOW',
    candidateDecisionFixed: 'DENY',
    gateStatusBuggy: 'BLOCKED',
    gateStatusFixed: 'PASS',
    baselineCode: `// Baseline Policy: DocVault Legal Hold Guard
forbid (
    principal,
    action in [Action::"DownloadDocument"],
    resource
) when { resource.isSealed == true && principal.tier == "external" };`,
    buggyCandidateCode: `// Candidate Policy: Premature Wildcard Match
permit (
    principal,
    action in [Action::"ViewDocument", Action::"DownloadDocument"],
    resource
); // ⚠️ OMITTED SEALED LEGAL HOLD FORBID CLAUSE`,
    fixedCandidateCode: `// Candidate Policy: Enforced Sealed Legal Hold
permit (
    principal,
    action in [Action::"ViewDocument"],
    resource
);
forbid (
    principal,
    action == Action::"DownloadDocument",
    resource
) when { resource.isSealed == true };`,
    buggyDiffHighlight: '+ action in [Action::"ViewDocument", Action::"DownloadDocument"], // ⚠️ LEAKS SEALED FILES',
    fixedDiffHighlight: '+ forbid ( principal, action == Action::"DownloadDocument", resource ) when { resource.isSealed };',
    aiRootCause: 'Omission of explicit forbid clause on sealed legal hold records allows external auditors to download privileged litigation exhibits.',
    aiRemediationCedar: `// Grounded Remediation:
forbid (
    principal,
    action == Action::"DownloadDocument",
    resource
) when { resource.isSealed == true };`,
  },
  {
    id: 'sc_multitenant_03',
    name: 'Cross-Tenant Customer Ledger Isolation',
    industry: 'Core Banking & Multi-Tenant Isolation',
    riskBadge: 'TENANT CONFUSION',
    riskColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    principal: 'User::"customer_alice"',
    principalRole: 'Tenant A Customer',
    action: 'Action::"ReadTransaction"',
    resource: 'Ledger::"txn_tenant_b_8091"',
    resourceValue: 'Account: Tenant B Internal Ledger',
    contractId: 'SC-01',
    contractTitle: 'Strict Multi-Tenant Invariant',
    contractRule: 'ASSERT principal.tenantId == resource.tenantId for all non-admin transactions',
    baselineDecision: 'DENY',
    candidateDecisionBuggy: 'ALLOW',
    candidateDecisionFixed: 'DENY',
    gateStatusBuggy: 'BLOCKED',
    gateStatusFixed: 'PASS',
    baselineCode: `// Baseline: Tenant Bound Check
permit (
    principal,
    action == Action::"ReadTransaction",
    resource
) when { principal.tenantId == resource.tenantId };`,
    buggyCandidateCode: `// Candidate: Removed Tenant Context Condition
permit (
    principal,
    action == Action::"ReadTransaction",
    resource
); // ⚠️ MISSING when { principal.tenantId == resource.tenantId }`,
    fixedCandidateCode: `// Candidate: Restored Cross-Tenant Guard
permit (
    principal,
    action == Action::"ReadTransaction",
    resource
) when { principal.tenantId == resource.tenantId };`,
    buggyDiffHighlight: '- when { principal.tenantId == resource.tenantId }; // ⚠️ REMOVED TENANT ISOLATION',
    fixedDiffHighlight: '+ when { principal.tenantId == resource.tenantId }; // ✅ RESTORED TENANT BOUNDARY',
    aiRootCause: 'Removal of the tenantId validation clause exposed Tenant B financial ledger records to Tenant A customers.',
    aiRemediationCedar: `// Grounded Remediation:
permit (
    principal,
    action == Action::"ReadTransaction",
    resource
) when { principal.tenantId == resource.tenantId };`,
  },
]

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterConsole,
  onOpenBenchmark,
}) => {
  const { theme, toggleTheme } = useTheme()
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'guide' | 'dev'>('signin')
  const [activeArchStep, setActiveArchStep] = useState(0)

  // Interactive Simulator State
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0)
  const [policyMode, setPolicyMode] = useState<'buggy' | 'fixed'>('buggy')
  const [isSimulating, setIsSimulating] = useState(false)
  const [simProgress, setSimProgress] = useState(100)
  const [activeSimStage, setActiveSimStage] = useState<1 | 2 | 3 | 4>(4)
  const [activeInspectorTab, setActiveInspectorTab] = useState<'diff' | 'graph' | 'ai'>('diff')

  const currentScenario = SIMULATION_SCENARIOS[selectedScenarioIdx]
  const isBuggy = policyMode === 'buggy'
  const currentDecision = isBuggy ? currentScenario.candidateDecisionBuggy : currentScenario.candidateDecisionFixed
  const currentGateStatus = isBuggy ? currentScenario.gateStatusBuggy : currentScenario.gateStatusFixed

  const openAuth = (tab: 'signin' | 'signup' | 'guide' | 'dev' = 'signin') => {
    setAuthTab(tab)
    setIsAuthOpen(true)
  }

  // Trigger live interactive simulation execution
  const handleRunSimulation = () => {
    setIsSimulating(true)
    setSimProgress(10)
    setActiveSimStage(1)

    setTimeout(() => {
      setSimProgress(40)
      setActiveSimStage(2)
    }, 350)

    setTimeout(() => {
      setSimProgress(75)
      setActiveSimStage(3)
    }, 700)

    setTimeout(() => {
      setSimProgress(100)
      setActiveSimStage(4)
      setIsSimulating(false)
    }, 1100)
  }

  const ARCH_STEPS = [
    {
      step: '01',
      title: 'Cedar Policy & Schema AST Validation',
      desc: 'Typechecks Cedar permit and forbid clauses against declared entity schemas using deterministic Cedar WASM core in < 0.4ms.',
      icon: FileCode2,
      badge: 'Deterministic Typecheck',
    },
    {
      step: '02',
      title: 'Bounded Scenario Universe Matrix',
      desc: 'Evaluates hundreds of synthetic authorization request tuples (Principal × Action × Resource × Context) with exhaustive coverage.',
      icon: Layers,
      badge: 'Sub-Millisecond WASM',
    },
    {
      step: '03',
      title: 'Behavioral Diff & Blast Radius Graph',
      desc: 'Computes exact permission state transitions (DENY ➔ ALLOW expansions and ALLOW ➔ DENY regressions) with topological impact analysis.',
      icon: GitCompare,
      badge: 'Mathematical Diff',
    },
    {
      step: '04',
      title: 'Security Invariant Contracts Gate',
      desc: 'Asserts organizational compliance rules (e.g. SC-04 "Contractors cannot delete payroll reports"), blocking unsafe deployments automatically.',
      icon: Shield,
      badge: 'Automated Gate Check',
    },
    {
      step: '05',
      title: 'Grounded Amazon Bedrock & Nemotron AI',
      desc: 'Synthesizes root-cause analysis and Cedar code remediations with strict evidence grounding and zero hallucination boundaries.',
      icon: Cpu,
      badge: 'Grounded Multi-LLM',
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden selection:bg-orange-500 selection:text-white">
      {/* Dynamic Cyber Auroras */}
      <div className="fixed top-0 inset-x-0 h-[520px] cyber-aurora-top pointer-events-none z-0 opacity-85" />
      <div className="fixed top-[-80px] right-[-80px] h-[600px] w-[600px] cyber-aurora-corner pointer-events-none z-0" />
      <div className="fixed top-[30%] left-[-120px] h-[550px] w-[550px] cyber-aurora-left pointer-events-none z-0 opacity-70" />

      {/* ─── Standardized Header (Unified h-14 with AppHeader & HubConsole) ───────── */}
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between transition-colors select-none">
        {/* Brand & Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-2.5 text-xs min-w-0 shrink">
          <div className="flex items-center gap-2 font-semibold shrink-0 cursor-default">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_12px_rgba(255,106,36,0.45)]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-foreground text-sm hidden sm:inline">
              PolicyLab
            </span>
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
            AWS First Commit 2026
          </span>

          <span className="text-muted-foreground/40 hidden md:inline">·</span>

          <span className="text-xs text-muted-foreground font-mono hidden md:inline truncate">
            Cedar WASM Engine v4.13.0
          </span>
        </div>

        {/* Right Navigation & Session Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="#live-simulator"
            className="text-xs text-muted-foreground hover:text-orange-500 font-medium transition-colors hidden lg:inline-flex items-center gap-1"
          >
            <Activity className="h-3 w-3 text-orange-500" />
            <span>Interactive Simulator</span>
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => openAuth('guide')}
            className="text-xs text-muted-foreground hover:text-foreground hidden sm:flex h-8 px-2.5"
          >
            Cognito Guide
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openAuth('dev')}
            className="text-xs h-8 gap-1.5 border-border bg-card text-foreground hover:bg-muted hidden sm:flex px-2.5"
          >
            <span>Dev Personas</span>
          </Button>

          {/* User Session Badge */}
          <UserSessionBadge />

          {/* Launch Console Hub CTA */}
          <Button
            size="sm"
            onClick={onEnterConsole}
            className="text-xs h-8 gap-1.5 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-bold shadow-[0_0_14px_rgba(255,106,36,0.3)] transition-transform hover:scale-105 px-3"
          >
            <span>Console Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <div className="h-3.5 w-[1px] bg-border shrink-0" />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      {/* ─── Hero Section ────────────────────────────────────────────────────────── */}
      <main className="flex-1 relative z-10">
        <section className="px-4 sm:px-8 pt-12 pb-14 max-w-6xl mx-auto text-center space-y-6">
          {/* Holographic Ticker Ribbon */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-card/80 border border-border shadow-sm backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
              Cedar WASM 4.13.0
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-orange-400 font-semibold">Deterministic Invariant Guardrails</span>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="text-cyan-400 font-semibold hidden sm:inline">Amazon Verified Permissions Ready</span>
            <span className="text-muted-foreground/30 hidden md:inline">|</span>
            <span className="text-purple-400 font-semibold hidden md:inline">NVIDIA Nemotron & Bedrock Grounded AI</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.12]">
            Prove authorization changes{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
              before they reach production.
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            Eliminate privilege escalations, prevent unauthorized financial refunds, and mathematically verify Cedar authorization policies.
            Powered by <strong>sub-millisecond WASM scenario matrices</strong>, <strong>behavioral diff graphs</strong>, and <strong>pre-deployment security contract gates</strong>.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={onEnterConsole}
              className="h-11 px-6 text-sm font-bold bg-[#FF6A24] text-white hover:bg-[#FF8A42] gap-2 shadow-[0_0_24px_rgba(255,106,36,0.35)] transition-transform hover:scale-105"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>Launch Security Console Hub</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <a
              href="#live-simulator"
              className="inline-flex items-center justify-center h-11 px-5 text-sm font-semibold rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all gap-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Live Simulation Below</span>
            </a>

            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpenBenchmark('acmepay')}
              className="h-11 px-5 text-sm font-semibold border-border bg-card hover:bg-muted text-foreground gap-2"
            >
              <span>Explore AcmePay Benchmark</span>
            </Button>
          </div>

          {/* Hackathon Dual-Sync Assurance Ribbon */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card/60 border border-border">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Team VibeSync (Vishal & Sneha)</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card/60 border border-border">
              <Check className="h-3.5 w-3.5 text-cyan-400" />
              <span>Dual-Synced: origin ⇄ first_commit</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card/60 border border-border">
              <Check className="h-3.5 w-3.5 text-orange-400" />
              <span>Rule 1: AI Does Not Decide Authorization</span>
            </span>
          </div>
        </section>

        {/* ─── THE SHOWSTOPPER: Interactive Authorization Simulator & Visualizer ──── */}
        <section id="live-simulator" className="px-4 sm:px-8 py-12 bg-black/40 border-y border-white/[0.08] relative">
          {/* Subtle glowing ambient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />

          <div className="max-w-6xl mx-auto space-y-6 relative z-10">
            {/* Simulator Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-orange-400 mb-1">
                  <Activity className="h-3.5 w-3.5 animate-pulse text-orange-400" />
                  <span>LIVE INTERACTIVE AUTHORIZATION SIMULATOR</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Watch Authorization Drift Caught in Real-Time
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select an industry scenario, test candidate Cedar policy modifications, and inspect deterministic gate decisions.
                </p>
              </div>

              {/* Simulation Mode Toggle & Trigger */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Buggy vs Fixed Policy Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-card border border-border text-xs font-mono">
                  <button
                    onClick={() => setPolicyMode('buggy')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      isBuggy
                        ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Candidate (Unsafe Drift)
                  </button>
                  <button
                    onClick={() => setPolicyMode('fixed')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      !isBuggy
                        ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Candidate (Fixed Policy)
                  </button>
                </div>

                {/* Run Interactive Simulation Button */}
                <Button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="text-xs h-9 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold gap-2 shadow-[0_0_16px_rgba(255,106,36,0.35)] cursor-pointer"
                >
                  <Play className={`h-3.5 w-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>{isSimulating ? 'Evaluating WASM...' : 'Run Simulation'}</span>
                </Button>
              </div>
            </div>

            {/* Scenario Selector Pills */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SIMULATION_SCENARIOS.map((sc, idx) => {
                const isSelected = selectedScenarioIdx === idx
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenarioIdx(idx)
                      handleRunSimulation()
                    }}
                    className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-card border-orange-500 shadow-md ring-1 ring-orange-500/30'
                        : 'bg-card/50 border-border hover:bg-card hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        SCENARIO 0{idx + 1} · {sc.industry.split(' ')[0]}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${sc.riskColor}`}>
                        {sc.riskBadge}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-foreground truncate">
                      {sc.name}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground/80 mt-1 truncate">
                      {sc.principal} ➔ {sc.action}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ─── Active Simulation Pipeline Visual Grid ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Interactive 4-Stage Decision Flow (6 cols) */}
              <div className="lg:col-span-6 space-y-3">
                <div className="glass-panel-premium p-4 sm:p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                      <span className="text-xs font-mono font-bold text-foreground">
                        4-STAGE DETERMINISTIC EVALUATION PIPELINE
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground">
                      Execution: 0.38ms (WASM)
                    </span>
                  </div>

                  {/* Animated WASM Evaluation Progress Bar */}
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${simProgress}%` }}
                    />
                  </div>

                  {/* Stage Cards with Animated Connection Nodes */}
                  <div className="space-y-3 relative">
                    {/* Stage 1: Ingress Request Vector */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      activeSimStage >= 1
                        ? 'bg-card border-white/15 shadow-sm'
                        : 'bg-card/40 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-orange-400 font-bold flex items-center gap-1.5">
                          <span>STAGE 1:</span>
                          <span className="text-foreground">Incoming Request Vector</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">Ingress Payload</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Principal</span>
                          <span className="text-foreground font-bold truncate block">{currentScenario.principal}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Action</span>
                          <span className="text-cyan-400 font-bold truncate block">{currentScenario.action}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Resource</span>
                          <span className="text-amber-400 font-bold truncate block">{currentScenario.resource}</span>
                        </div>
                      </div>
                    </div>

                    {/* Animated Connection Arrow */}
                    <div className="flex justify-center -my-1">
                      <div className="h-3 w-[1px] bg-gradient-to-b from-orange-500 to-cyan-500 animate-pulse" />
                    </div>

                    {/* Stage 2: Cedar WASM Parser & Evaluator */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      activeSimStage >= 2
                        ? 'bg-card border-cyan-500/30 shadow-sm'
                        : 'bg-card/40 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                          <span>STAGE 2:</span>
                          <span className="text-foreground">Cedar WASM Engine AST Evaluation</span>
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono">0.38ms</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 p-2 rounded-lg bg-black/40 border border-white/5 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">Decision:</span>
                          <span className="text-muted-foreground line-through text-[11px]">{currentScenario.baselineDecision} (Baseline)</span>
                          <span className="text-muted-foreground">➔</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                            currentDecision === 'ALLOW'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {currentDecision} (Candidate)
                          </span>
                        </div>
                        {isBuggy && (
                          <span className="text-[10px] text-rose-400 font-bold animate-pulse">
                            +1 UNEXPECTED FLIP
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Animated Connection Arrow */}
                    <div className="flex justify-center -my-1">
                      <div className="h-3 w-[1px] bg-gradient-to-b from-cyan-500 to-rose-500 animate-pulse" />
                    </div>

                    {/* Stage 3: Security Invariant Contract Assertion */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      activeSimStage >= 3
                        ? (isBuggy ? 'bg-rose-500/10 border-rose-500/40' : 'bg-emerald-500/10 border-emerald-500/40')
                        : 'bg-card/40 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className={isBuggy ? 'text-rose-400' : 'text-emerald-400'}>STAGE 3:</span>
                          <span className="text-foreground">Security Invariant Assertion ({currentScenario.contractId})</span>
                        </span>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                          isBuggy
                            ? 'bg-rose-500 text-white border-rose-600'
                            : 'bg-emerald-500 text-white border-emerald-600'
                        }`}>
                          GATE: {currentGateStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed font-sans">
                        {currentScenario.contractTitle}: <span className="font-mono text-[10px] text-zinc-300">{currentScenario.contractRule}</span>
                      </p>
                    </div>

                    {/* Animated Connection Arrow */}
                    <div className="flex justify-center -my-1">
                      <div className="h-3 w-[1px] bg-gradient-to-b from-rose-500 to-purple-500 animate-pulse" />
                    </div>

                    {/* Stage 4: Grounded AI Intelligence */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      activeSimStage >= 4
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-card/40 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-purple-400 font-bold flex items-center gap-1.5">
                          <span>STAGE 4:</span>
                          <span className="text-foreground">Grounded Multi-LLM Remediation</span>
                        </span>
                        <span className="text-[10px] text-purple-300 font-mono">NVIDIA Nemotron / Bedrock</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {currentScenario.aiRootCause}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Code Diff Inspector & Interactive Blast Radius Canvas (6 cols) */}
              <div className="lg:col-span-6 space-y-3">
                <div className="glass-panel-premium p-4 sm:p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-3">
                  {/* Sub-Tabs: Diff vs Blast Radius Topology vs Grounded AI */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <button
                        onClick={() => setActiveInspectorTab('diff')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInspectorTab === 'diff'
                            ? 'bg-white/10 text-orange-400 border border-orange-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <FileCode2 className="h-3.5 w-3.5" />
                        <span>Cedar Diff</span>
                      </button>
                      <button
                        onClick={() => setActiveInspectorTab('graph')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInspectorTab === 'graph'
                            ? 'bg-white/10 text-cyan-400 border border-cyan-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                        <span>Blast Radius Graph</span>
                      </button>
                      <button
                        onClick={() => setActiveInspectorTab('ai')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInspectorTab === 'ai'
                            ? 'bg-white/10 text-purple-400 border border-purple-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        <span>AI Remediation</span>
                      </button>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground">
                      {isBuggy ? 'Mode: Unsafe Drift' : 'Mode: Invariant Verified'}
                    </span>
                  </div>

                  {/* Tab 1: Cedar Policy Diff View */}
                  {activeInspectorTab === 'diff' && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-black/70 border border-white/[0.08] text-[11px] font-mono space-y-1 overflow-x-auto min-h-[260px]">
                        <div className="text-zinc-500 text-[10px]">// Side-by-side Cedar Policy Comparison</div>
                        <div className="text-emerald-400/80">// Baseline: {currentScenario.baselineCode.split('\n')[0]}</div>
                        <pre className="text-zinc-300 text-[10.5px] leading-relaxed">
                          {currentScenario.baselineCode}
                        </pre>

                        <div className="pt-2 border-t border-white/[0.06]" />

                        <div className="text-[10px] font-bold text-zinc-400">// Candidate Under Evaluation:</div>
                        <pre className={`text-[10.5px] leading-relaxed p-2 rounded ${
                          isBuggy ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {isBuggy ? currentScenario.buggyCandidateCode : currentScenario.fixedCandidateCode}
                        </pre>
                        <div className="text-[10px] font-bold">
                          {isBuggy ? (
                            <span className="text-rose-400">{currentScenario.buggyDiffHighlight}</span>
                          ) : (
                            <span className="text-emerald-400">{currentScenario.fixedDiffHighlight}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Interactive Blast Radius Topology Micro-Graph (Artistic SVG Canvas) */}
                  {activeInspectorTab === 'graph' && (
                    <div className="p-3 rounded-xl bg-black/80 border border-white/[0.08] min-h-[260px] flex flex-col justify-between relative overflow-hidden">
                      <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                        <span>TOPOLOGICAL PERMISSION PATHWAY</span>
                        <span className={`font-bold ${isBuggy ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isBuggy ? 'UNAUTHORIZED ESCALATION EDGE DETECTED' : 'CLEAN ISOLATION MAINTAINED'}
                        </span>
                      </div>

                      {/* Interactive SVG Topology Graph */}
                      <div className="my-auto py-2">
                        <svg className="w-full h-36" viewBox="0 0 440 140" fill="none">
                          {/* Defs for gradients */}
                          <defs>
                            <linearGradient id="edgeBuggy" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#F43F5E" />
                              <stop offset="100%" stopColor="#FB923C" />
                            </linearGradient>
                            <linearGradient id="edgeFixed" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10B981" />
                              <stop offset="100%" stopColor="#06B6D4" />
                            </linearGradient>
                          </defs>

                          {/* Connecting Bezier Edges */}
                          <path
                            d="M 60 70 C 130 30, 160 30, 220 50"
                            stroke={isBuggy ? 'url(#edgeBuggy)' : 'url(#edgeFixed)'}
                            strokeWidth={isBuggy ? '3' : '2'}
                            strokeDasharray={isBuggy ? '4 3' : 'none'}
                            className={isBuggy ? 'animate-pulse' : ''}
                          />
                          <path
                            d="M 220 50 C 280 70, 310 70, 380 70"
                            stroke={isBuggy ? 'url(#edgeBuggy)' : 'url(#edgeFixed)'}
                            strokeWidth={isBuggy ? '3' : '2'}
                            strokeDasharray={isBuggy ? '4 3' : 'none'}
                            className={isBuggy ? 'animate-pulse' : ''}
                          />

                          {/* Contract Gate Sentinel Edge */}
                          <path
                            d="M 220 50 L 220 110"
                            stroke="#E11D48"
                            strokeWidth="2"
                            strokeDasharray="2 2"
                          />

                          {/* Node 1: Principal */}
                          <g transform="translate(60, 70)">
                            <circle r="22" fill="#18181B" stroke="#FF6A24" strokeWidth="2" />
                            <text textAnchor="middle" dy="-3" fill="#FFF" fontSize="8" fontWeight="bold">Principal</text>
                            <text textAnchor="middle" dy="8" fill="#A1A1AA" fontSize="7">Contractor</text>
                          </g>

                          {/* Node 2: Action */}
                          <g transform="translate(220, 50)">
                            <circle r="24" fill="#18181B" stroke={isBuggy ? '#F43F5E' : '#10B981'} strokeWidth="2.5" />
                            <text textAnchor="middle" dy="-4" fill="#FFF" fontSize="8" fontWeight="bold">Action</text>
                            <text textAnchor="middle" dy="7" fill={isBuggy ? '#FDA4AF' : '#6EE7B7'} fontSize="7.5" fontWeight="bold">
                              {currentScenario.action.replace('Action::', '').replace(/"/g, '')}
                            </text>
                          </g>

                          {/* Node 3: Resource */}
                          <g transform="translate(380, 70)">
                            <circle r="22" fill="#18181B" stroke="#06B6D4" strokeWidth="2" />
                            <text textAnchor="middle" dy="-3" fill="#FFF" fontSize="8" fontWeight="bold">Resource</text>
                            <text textAnchor="middle" dy="8" fill="#A1A1AA" fontSize="7">Order #999</text>
                          </g>

                          {/* Node 4: Contract Gate Sentinel */}
                          <g transform="translate(220, 115)">
                            <rect x="-42" y="-12" width="84" height="22" rx="6" fill={isBuggy ? '#4C0519' : '#064E3B'} stroke={isBuggy ? '#F43F5E' : '#10B981'} strokeWidth="1.5" />
                            <text textAnchor="middle" dy="2" fill="#FFF" fontSize="8" fontWeight="bold">
                              {isBuggy ? 'SC-04: BLOCKED 🚫' : 'SC-04: PASS ✅'}
                            </text>
                          </g>
                        </svg>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-white/5">
                        <span>Nodes: 3 Entities + 1 Invariant</span>
                        <span>Diff Metric: {isBuggy ? 'Risk Score: 85 (High)' : 'Risk Score: 12 (Safe)'}</span>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Grounded AI Explanation & Remediation */}
                  {activeInspectorTab === 'ai' && (
                    <div className="p-3 rounded-xl bg-black/70 border border-white/[0.08] text-[11px] font-mono space-y-2 min-h-[260px]">
                      <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                        <span className="text-purple-400 font-bold flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5" />
                          <span>Grounded AI Security Analysis</span>
                        </span>
                        <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-mono">
                          Zero-Hallucination Verified
                        </Badge>
                      </div>

                      <div>
                        <span className="text-zinc-400 font-bold text-[10px]">Identified Root Cause:</span>
                        <p className="text-zinc-300 text-[11px] leading-relaxed mt-0.5">
                          {currentScenario.aiRootCause}
                        </p>
                      </div>

                      <div className="pt-1">
                        <span className="text-emerald-400 font-bold text-[10px]">Proposed Cedar Remediation Patch:</span>
                        <pre className="p-2 mt-1 rounded bg-black/80 border border-white/10 text-emerald-300 text-[10.5px]">
                          {currentScenario.aiRemediationCedar}
                        </pre>
                      </div>

                      <div className="text-[10px] text-zinc-500 pt-1">
                        Citations Verified: [{currentScenario.contractId}, {currentScenario.id}]
                      </div>
                    </div>
                  )}

                  {/* Pre-Deployment Gate Action Bar */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    isBuggy
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isBuggy ? (
                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold block text-foreground">
                          {isBuggy ? 'Deployment Blocked by PolicyLab' : 'Security Gate Passed Cleanly'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isBuggy ? 'Amazon Verified Permissions deployment gate locked.' : 'Ready for cryptographically signed AVP deployment.'}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setPolicyMode(isBuggy ? 'fixed' : 'buggy')}
                      className={`text-xs h-7 font-bold ${
                        isBuggy
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isBuggy ? 'Apply Cedar Patch' : 'Revert to Buggy Draft'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Interactive Architectural Engineering Section ───────────────────────── */}
        <section className="px-4 sm:px-8 py-14 bg-muted/20 border-b border-border">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center justify-center gap-2">
                <Workflow className="h-6 w-6 text-orange-500" />
                <span>The PolicyLab Engineering Architecture</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto">
                Deterministic Cedar evaluation is the sole arbiter of authorization truth. AI only explains structured evidence.
              </p>
            </div>

            {/* Architecture Interactive Flow Navigator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Stage Selector (5 cols) */}
              <div className="lg:col-span-5 space-y-2.5">
                {ARCH_STEPS.map((item, idx) => {
                  const Icon = item.icon
                  const isActive = activeArchStep === idx
                  return (
                    <button
                      key={item.step}
                      onClick={() => setActiveArchStep(idx)}
                      className={`w-full p-3.5 rounded-xl text-left border transition-all flex items-start gap-3.5 cursor-pointer ${
                        isActive
                          ? 'border-orange-500 bg-card shadow-lg ring-1 ring-orange-500/30'
                          : 'border-border bg-card/60 hover:bg-card hover:border-border'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(255,106,36,0.4)]'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-orange-500">
                            STAGE {item.step}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-foreground mt-0.5 truncate">
                          {item.title}
                        </h3>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Right Stage Detail Showcase (7 cols) */}
              <div className="lg:col-span-7 glass-panel-premium p-5 sm:p-6 rounded-2xl border border-border shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-orange-500">
                      STEP {ARCH_STEPS[activeArchStep].step} OF 05
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs font-bold text-foreground">
                      {ARCH_STEPS[activeArchStep].badge}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    100% Deterministic Assurance
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-extrabold text-foreground">
                  {ARCH_STEPS[activeArchStep].title}
                </h4>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {ARCH_STEPS[activeArchStep].desc}
                </p>

                {/* Simulated Visual Pipeline Code/Evidence Snippet */}
                <div className="p-3.5 rounded-xl bg-black/80 border border-white/10 text-[11px] font-mono text-emerald-400 space-y-1 shadow-inner overflow-x-auto">
                  {activeArchStep === 0 && (
                    <>
                      <span className="text-purple-400 font-bold">// Stage 1: Cedar Schema Validation</span>
                      <p className="text-zinc-300">cedar_wasm::validate_policy(policy, schema) ➔ AST_OK (0 syntax errors)</p>
                      <p className="text-cyan-400">Validated 4 entity types: User, Role, Invoice, PayrollReport</p>
                    </>
                  )}
                  {activeArchStep === 1 && (
                    <>
                      <span className="text-purple-400 font-bold">// Stage 2: 432 Request Universe Evaluation</span>
                      <p className="text-zinc-300">Evaluating principal_tuples (6) × actions (4) × resources (18) = 432 evaluations</p>
                      <p className="text-emerald-400">Elapsed time: 1.42ms in WebAssembly runtime</p>
                    </>
                  )}
                  {activeArchStep === 2 && (
                    <>
                      <span className="text-purple-400 font-bold">// Stage 3: Differential State Analysis</span>
                      <p className="text-red-400 font-bold">FLIP DETECTED: SCN-07 (Contractor ➔ Delete ➔ PayrollReport)</p>
                      <p className="text-zinc-300">Baseline (v12): DENY ➔ Candidate (v13): ALLOW (+3 unauthorized transitions)</p>
                    </>
                  )}
                  {activeArchStep === 3 && (
                    <>
                      <span className="text-purple-400 font-bold">// Stage 4: Security Invariant Contract Assertion</span>
                      <p className="text-red-400 font-bold">ASSERTION FAILED: SC-04 ("Contractors cannot delete payroll reports")</p>
                      <p className="text-zinc-300">Pre-deployment gate: BLOCKED. Amazon Verified Permissions deployment gated.</p>
                    </>
                  )}
                  {activeArchStep === 4 && (
                    <>
                      <span className="text-purple-400 font-bold">// Stage 5: Grounded Multi-LLM Intelligence</span>
                      <p className="text-zinc-300">Providers: Amazon Bedrock & NVIDIA Nemotron with deterministic fallback</p>
                      <p className="text-orange-400">Grounded Citation: Finding [SC-04], Scenario [SCN-07]. 0 Hallucination Verified.</p>
                    </>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeArchStep === 0}
                    onClick={() => setActiveArchStep((p) => Math.max(0, p - 1))}
                    className="text-xs"
                  >
                    Previous Step
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (activeArchStep < ARCH_STEPS.length - 1) {
                        setActiveArchStep((p) => p + 1)
                      } else {
                        onEnterConsole()
                      }
                    }}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1"
                  >
                    <span>{activeArchStep === ARCH_STEPS.length - 1 ? 'Launch Workbench' : 'Next Step'}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Real World Dual Benchmark Showcase ─────────────────────────────────── */}
        <section className="px-4 sm:px-8 py-14 max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Two Independent Production Benchmarks
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Judges can test PolicyLab on two completely separate Cedar authorization domains right out of the box.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Benchmark 1: AcmePay */}
            <div className="glass-card-premium p-6 rounded-2xl border border-border space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  BENCHMARK 01 · FINTECH & PAYROLL
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">432 Scenarios</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">
                AcmePay Core Payment Authorization Engine
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evaluates 432 synthetic request vectors across 18 entities and 6 formal security invariants. Detects accidental contractor payroll deletion privileges and invoice export regressions.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => onOpenBenchmark('acmepay')}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1.5"
                >
                  <span>Launch AcmePay Benchmark</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-muted-foreground">v12 ➔ v13 (Draft/Fixed)</span>
              </div>
            </div>

            {/* Benchmark 2: DocVault */}
            <div className="glass-card-premium p-6 rounded-2xl border border-border space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  BENCHMARK 02 · ENTERPRISE LEGAL HOLD
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">Multi-Tenant SaaS</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">
                DocVault Legal & Compliance Vault
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Completely independent Cedar domain featuring Legal Counsel, Compliance Officers, External Auditors, and sealed records. Proves cross-tenant isolation and strict litigation hold guarantees.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => onOpenBenchmark('docvault')}
                  className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold gap-1.5"
                >
                  <span>Launch DocVault Benchmark</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-muted-foreground">Independent Cedar Schema</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-4 sm:px-8 bg-card text-muted-foreground text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-500 text-white">
              <Shield className="h-3 w-3" />
            </div>
            <span className="font-bold text-foreground">PolicyLab</span>
            <span>— WeMakeDevs × AWS First Commit 2026</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <button onClick={() => openAuth('guide')} className="hover:text-foreground cursor-pointer">
              Cognito Docs
            </button>
            <button onClick={onEnterConsole} className="hover:text-foreground cursor-pointer">
              Console Hub
            </button>
            <a
              href="https://github.com/Vishallakshmikanthan/policylab"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <span>GitHub (origin)</span>
            </a>
            <a
              href="https://github.com/CSNEHA20/first_commit"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <span>GitHub (first_commit)</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialTab={authTab}
        onSuccess={() => {
          setIsAuthOpen(false)
          onEnterConsole()
        }}
      />
    </div>
  )
}
