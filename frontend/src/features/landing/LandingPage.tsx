import React, { useState } from 'react'
import {
  Shield,
  ArrowRight,
  Sparkles,
  Zap,
  GitCompare,
  Layers,
  FileCode2,
  Lock,
  Cpu,
  Workflow,
  CheckCircle2,
  Cloud,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/ThemeProvider'
import { AuthModal } from '@/features/auth/AuthModal'

interface LandingPageProps {
  onEnterConsole: () => void
  onOpenBenchmark: (benchmark: 'acmepay' | 'docvault') => void
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterConsole,
  onOpenBenchmark,
}) => {
  const { theme, toggleTheme } = useTheme()
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'guide' | 'dev'>('signin')
  const [activeArchStep, setActiveArchStep] = useState(0)

  const openAuth = (tab: 'signin' | 'signup' | 'guide' | 'dev' = 'signin') => {
    setAuthTab(tab)
    setIsAuthOpen(true)
  }

  const ARCH_STEPS = [
    {
      step: '01',
      title: 'Cedar Policy & Schema AST Validation',
      desc: 'Typechecks Cedar permit and forbid clauses against declared entity schemas using deterministic Cedar WASM core.',
      icon: FileCode2,
      badge: 'Deterministic Typecheck',
    },
    {
      step: '02',
      title: 'Bounded Scenario Universe Matrix',
      desc: 'Generates and evaluates hundreds of synthetic authorization request tuples (Principal × Action × Resource × Context) in sub-milliseconds.',
      icon: Layers,
      badge: 'Sub-Millisecond WASM',
    },
    {
      step: '03',
      title: 'Behavioral Diff & Blast Radius Graph',
      desc: 'Computes exact permission state transitions (DENY ➔ ALLOW expansions and ALLOW ➔ DENY regressions) with topology impact analysis.',
      icon: GitCompare,
      badge: 'Mathematical Diff',
    },
    {
      step: '04',
      title: 'Security Invariant Contracts Gate',
      desc: 'Asserts organizational compliance rules (e.g. SC-04 "Contractors cannot delete payroll reports"), blocking unsafe candidate deployments.',
      icon: Shield,
      badge: 'Automated Gate Check',
    },
    {
      step: '05',
      title: 'Grounded Amazon Bedrock Intelligence',
      desc: 'Synthesizes root cause analysis and Cedar code remediations with strict evidence grounding to prevent hallucination.',
      icon: Cpu,
      badge: 'AWS Bedrock Grounded',
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden selection:bg-orange-500 selection:text-white">
      {/* Top Atmospheric Cyber Light Gradients */}
      <div className="fixed top-0 inset-x-0 h-[450px] cyber-aurora-top pointer-events-none z-0" />
      <div className="fixed top-[-100px] right-[-100px] h-[550px] w-[550px] cyber-aurora-corner pointer-events-none z-0" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_14px_rgba(255,106,36,0.4)]">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-foreground text-sm flex items-center gap-1.5">
              PolicyLab
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
                AWS AVP
              </span>
            </span>
          </div>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openAuth('guide')}
            className="text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
          >
            Cognito Guide
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openAuth('dev')}
            className="text-xs h-8 gap-1.5 border-border bg-card text-foreground hover:bg-muted"
          >
            <span>Dev Personas</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openAuth('signin')}
            className="text-xs h-8 border-border bg-card text-foreground hover:bg-muted"
          >
            Sign In
          </Button>

          <Button
            size="sm"
            onClick={onEnterConsole}
            className="text-xs h-8 gap-1.5 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-md transition-transform hover:scale-105"
          >
            <span>Console Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-[1px] bg-border ml-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10">
        <section className="px-4 sm:px-8 pt-16 pb-20 max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Deterministic Authorization Pre-Deployment Guardrails</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
            Prove authorization changes{' '}
            <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
              before they reach production.
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            PolicyLab provides mathematical behavioral diffing, sub-millisecond scenario universe simulation,
            and formal invariant security contract testing for <strong>Amazon Verified Permissions</strong> and <strong>Cedar</strong> policy stores.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Button
              size="lg"
              onClick={onEnterConsole}
              className="h-11 px-6 text-sm font-bold bg-[#FF6A24] text-white hover:bg-[#FF8A42] gap-2 shadow-[0_0_24px_rgba(255,106,36,0.35)] transition-transform hover:scale-105"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>Launch Central Console Hub</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpenBenchmark('acmepay')}
              className="h-11 px-6 text-sm font-semibold border-border bg-card hover:bg-muted text-foreground gap-2"
            >
              <span>Explore AcmePay Benchmark (432 Scenarios)</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpenBenchmark('docvault')}
              className="h-11 px-6 text-sm font-semibold border-border bg-card hover:bg-muted text-foreground gap-2"
            >
              <span>Explore DocVault Multi-Tenant Benchmark</span>
            </Button>
          </div>

          {/* Engine Highlights Pills */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Cedar Engine v4.13.0 WASM</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-500" />
              <span>Amazon Verified Permissions Ready</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border">
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
              <span>Amazon Bedrock Grounded AI</span>
            </span>
          </div>
        </section>

        {/* Interactive Architectural Engineering Section */}
        <section className="px-4 sm:px-8 py-16 bg-muted/20 border-y border-border">
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
                      className={`w-full p-4 rounded-xl text-left border transition-all flex items-start gap-3.5 ${
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
                        <h3 className="text-sm font-bold text-foreground mt-0.5 truncate">
                          {item.title}
                        </h3>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Right Stage Detail Showcase (7 cols) */}
              <div className="lg:col-span-7 glass-panel-premium p-6 rounded-2xl border border-border shadow-xl space-y-4">
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

                <h4 className="text-lg font-extrabold text-foreground">
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
                      <span className="text-purple-400 font-bold">// Stage 5: Amazon Bedrock Grounded Explanation</span>
                      <p className="text-zinc-300">Model: anthropic.claude-3-5-sonnet on Amazon Bedrock</p>
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

        {/* Feature Grid Section */}
        <section className="px-4 sm:px-8 py-16 max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Enterprise Authorization Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Everything engineering and security teams need to govern Cedar authorization safely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card-premium p-5 rounded-2xl space-y-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
                <GitCompare className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Blast Radius & Behavioral Diff
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mathematically maps every permission transition across roles and entity types. Prevents accidental privilege escalation.
              </p>
            </div>

            <div className="glass-card-premium p-5 rounded-2xl space-y-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Security Invariant Contracts
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define formal organizational security rules as executable regression test suites. Gate CI/CD and deployment pipelines automatically.
              </p>
            </div>

            <div className="glass-card-premium p-5 rounded-2xl space-y-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
                <Cloud className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                AWS Verified Permissions Sync
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Direct deployment gates to Amazon Verified Permissions policy stores, verified with Cognito JWT and cryptographic approval tokens.
              </p>
            </div>
          </div>
        </section>

        {/* Real World Use Cases */}
        <section className="px-4 sm:px-8 py-16 bg-muted/20 border-t border-border">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Grounded Across Critical Industries
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Proven benchmark scenarios tested with real multi-tenant policies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card-premium p-6 rounded-2xl border border-border space-y-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  FINTECH & PAYROLL BENCHMARK
                </span>
                <h3 className="text-base font-bold text-foreground">
                  AcmePay Core Authorization Engine
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  432 synthetic scenario vectors across 18 entities and 6 formal security invariants. Detects accidental contractor payroll deletion privileges and invoice export regressions.
                </p>
                <Button
                  size="sm"
                  onClick={() => onOpenBenchmark('acmepay')}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1.5"
                >
                  <span>Launch AcmePay Benchmark</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="glass-card-premium p-6 rounded-2xl border border-border space-y-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  MULTI-TENANT SAAS BENCHMARK
                </span>
                <h3 className="text-base font-bold text-foreground">
                  DocVault Secure Document Management
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Strict cross-tenant data isolation and classification levels (Confidential, Restricted). Proves that contractor role changes cannot leak documents across tenant boundaries.
                </p>
                <Button
                  size="sm"
                  onClick={() => onOpenBenchmark('docvault')}
                  className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold gap-1.5"
                >
                  <span>Launch DocVault Benchmark</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
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
            <button onClick={() => openAuth('guide')} className="hover:text-foreground">
              Cognito Docs
            </button>
            <button onClick={onEnterConsole} className="hover:text-foreground">
              Console Hub
            </button>
            <a
              href="https://github.com/Vishallakshmikanthan/policylab"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <span>GitHub Repo</span>
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
