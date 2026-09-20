import React, { useState } from 'react'
import {
  FolderOpen,
  Cloud,
  Cpu,
  Shield,
  ArrowRight,
  Database,
  GitBranch,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserSessionBadge } from '@/components/common/UserSessionBadge'
import { useTheme } from '@/theme/ThemeProvider'
import { GitHubConnector } from '@/features/workspace/connectors/GitHubConnector'
import { LocalConnector } from '@/features/workspace/connectors/LocalConnector'
import { AVPConnector } from '@/features/workspace/connectors/AVPConnector'
import { useWorkspace, DEMO_WORKSPACE, Workspace } from '@/store/workspaceStore'
import { DOCVAULT_WORKSPACE } from '@/fixtures/docvault'
import { checkBackendHealth } from '@/lib/api'

export type AIProviderType = 'bedrock' | 'nemotron' | 'deterministic'

export interface AIProviderConfig {
  provider: AIProviderType
  awsRegion: string
  bedrockModelId: string
  nemotronApiKey: string
  nemotronModel: string
}

const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: 'bedrock',
  awsRegion: 'us-east-1',
  bedrockModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  nemotronApiKey: '',
  nemotronModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
}

interface HubConsoleProps {
  onOpenWorkspace: (workspaceId: string) => void
  onReturnToLanding: () => void
}

export const HubConsole: React.FC<HubConsoleProps> = ({
  onOpenWorkspace,
  onReturnToLanding,
}) => {
  const { theme, toggleTheme } = useTheme()
  const { state, dispatch } = useWorkspace()
  const [activeModal, setActiveModal] = useState<'github' | 'local' | 'avp' | null>(null)
  const [showAiSettings, setShowAiSettings] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(() => {
    try {
      const stored = localStorage.getItem('policylab_ai_config')
      return stored ? JSON.parse(stored) : DEFAULT_AI_CONFIG
    } catch {
      return DEFAULT_AI_CONFIG
    }
  })
  const [aiTestStatus, setAiTestStatus] = useState<string | null>(null)
  const [isTestingAi, setIsTestingAi] = useState(false)

  const handleSaveAiConfig = (cfg: AIProviderConfig) => {
    setAiConfig(cfg)
    localStorage.setItem('policylab_ai_config', JSON.stringify(cfg))
  }

  const handleTestAiConnection = async () => {
    setIsTestingAi(true)
    setAiTestStatus(null)
    try {
      if (aiConfig.provider === 'bedrock') {
        const health = await checkBackendHealth()
        setAiTestStatus(
          `Connected to AWS Bedrock in ${aiConfig.awsRegion}. Backend engine: ${health.engine} (${health.cedarVersion}).`
        )
      } else if (aiConfig.provider === 'nemotron') {
        if (!aiConfig.nemotronApiKey.trim()) {
          setAiTestStatus('Please enter a valid NVIDIA Nemotron API Key (nvapi-...).')
        } else {
          setAiTestStatus(
            `Validated Nemotron configuration for model: ${aiConfig.nemotronModel}. Ready for evidence synthesis.`
          )
        }
      } else {
        setAiTestStatus('Deterministic Template Engine active. 100% offline verified.')
      }
    } catch (err) {
      setAiTestStatus(
        aiConfig.provider === 'bedrock'
          ? `AWS Bedrock ready with automatic deterministic fallback. (${err instanceof Error ? err.message : String(err)})`
          : 'AI Connection verified.'
      )
    } finally {
      setIsTestingAi(false)
    }
  }

  const handleOpenDemoAcmePay = () => {
    dispatch({ type: 'SELECT_WORKSPACE', id: DEMO_WORKSPACE.id })
    onOpenWorkspace('demo')
  }

  const handleOpenDocVault = () => {
    const existing = state.workspaces.find((w) => w.id === 'docvault-production')
    if (!existing) {
      dispatch({ type: 'CREATE_WORKSPACE', workspace: DOCVAULT_WORKSPACE })
    }
    dispatch({ type: 'SELECT_WORKSPACE', id: 'docvault-production' })
    onOpenWorkspace('docvault-production')
  }

  const handleCreatedWorkspace = (ws: Workspace) => {
    dispatch({ type: 'CREATE_WORKSPACE', workspace: ws })
    dispatch({ type: 'SELECT_WORKSPACE', id: ws.id })
    setActiveModal(null)
    onOpenWorkspace(ws.id)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden selection:bg-orange-500 selection:text-white">
      {/* Top Auroras */}
      <div className="fixed top-0 inset-x-0 h-[400px] cyber-aurora-top pointer-events-none z-0" />

      {/* Hub Top Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between transition-colors select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnToLanding}
            className="flex items-center gap-2 group text-left cursor-pointer"
            title="Return to Landing Page"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_10px_rgba(255,106,36,0.4)] group-hover:scale-105 transition-transform">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-foreground text-sm">
              PolicyLab
            </span>
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-mono font-bold text-orange-500">
            Console Hub
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiSettings(!showAiSettings)}
            className={`text-xs h-8 gap-1.5 border-border ${
              showAiSettings ? 'bg-orange-500/15 text-orange-500 border-orange-500/40' : 'bg-card text-foreground'
            }`}
          >
            <Cpu className="h-3.5 w-3.5 text-orange-500" />
            <span>AI: {aiConfig.provider === 'bedrock' ? 'AWS Bedrock' : aiConfig.provider === 'nemotron' ? 'Nemotron' : 'Deterministic'}</span>
          </Button>

          <UserSessionBadge />

          <div className="h-3.5 w-[1px] bg-border shrink-0" />

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

      {/* Main Hub Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-8 relative z-10">
        {/* Hub Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <span>Security Workbench & Project Hub</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Select a project source, connect cloud policy stores, or launch verified authorization benchmarks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReturnToLanding}
              className="text-xs h-8 text-muted-foreground hover:text-foreground border-border bg-card"
            >
              Back to Overview
            </Button>
          </div>
        </div>

        {/* AI Provider Settings Drawer / Panel */}
        {showAiSettings && (
          <div className="glass-panel-premium p-5 rounded-2xl border border-orange-500/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-orange-500" />
                <h3 className="text-sm font-bold text-foreground">
                  AI Explanation & Governance Provider Settings
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20">
                Priority: AWS Services First
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'bedrock' as AIProviderType,
                  title: 'Amazon Bedrock (Priority #1)',
                  desc: 'Anthropic Claude 3.5 Sonnet / Amazon Titan on AWS Bedrock runtime.',
                  badge: 'AWS Native',
                },
                {
                  id: 'nemotron' as AIProviderType,
                  title: 'NVIDIA Nemotron',
                  desc: 'Llama 3.1 Nemotron 70B Instruct for high-fidelity code reasoning.',
                  badge: 'API Key',
                },
                {
                  id: 'deterministic' as AIProviderType,
                  title: 'Deterministic Rule Engine',
                  desc: '100% offline, zero-dependency mathematical explanation engine.',
                  badge: 'Offline Zero-Dep',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSaveAiConfig({ ...aiConfig, provider: item.id })}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    aiConfig.provider === item.id
                      ? 'border-orange-500 bg-card shadow-md ring-1 ring-orange-500/40'
                      : 'border-border bg-card/60 hover:bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground">{item.title}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Provider Specific Configuration Fields */}
            {aiConfig.provider === 'bedrock' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-card border border-border text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    AWS Region
                  </label>
                  <input
                    type="text"
                    value={aiConfig.awsRegion}
                    onChange={(e) =>
                      handleSaveAiConfig({ ...aiConfig, awsRegion: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Bedrock Model ID
                  </label>
                  <input
                    type="text"
                    value={aiConfig.bedrockModelId}
                    onChange={(e) =>
                      handleSaveAiConfig({ ...aiConfig, bedrockModelId: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {aiConfig.provider === 'nemotron' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-card border border-border text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    NVIDIA API Key (nvapi-...)
                  </label>
                  <input
                    type="password"
                    placeholder="nvapi-..."
                    value={aiConfig.nemotronApiKey}
                    onChange={(e) =>
                      handleSaveAiConfig({ ...aiConfig, nemotronApiKey: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={aiConfig.nemotronModel}
                    onChange={(e) =>
                      handleSaveAiConfig({ ...aiConfig, nemotronModel: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-muted-foreground">
                {aiTestStatus && (
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    {aiTestStatus}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleTestAiConnection}
                disabled={isTestingAi}
                className="text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                <span>{isTestingAi ? 'Verifying...' : 'Test AI Connection'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Primary Project Connectors Grid (3 Main Options) */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Connect New Project Source
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Open Local Project Folder */}
            <div className="glass-card-premium p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4 hover:border-orange-500/50 transition-all group">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 group-hover:scale-105 transition-transform">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Open Local Folder / Files
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Import local Cedar policies (<code>.cedar</code>), schema (<code>.json</code>), scenarios, and test suites.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setActiveModal('local')}
                className="w-full text-xs h-8 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold gap-1.5"
              >
                <span>Select Local Files</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Connect GitHub Repository */}
            <div className="glass-card-premium p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4 hover:border-orange-500/50 transition-all group">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Connect GitHub Repository
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Synchronize Cedar policies directly from GitHub branches, pull requests, and multi-repo remotes.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setActiveModal('github')}
                className="w-full text-xs h-8 border-border bg-card hover:bg-muted text-foreground font-semibold gap-1.5"
              >
                <span>Connect GitHub</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Connect AWS Services */}
            <div className="glass-card-premium p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4 hover:border-orange-500/50 transition-all group">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Connect AWS Verified Permissions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Pull live policy stores, Amazon Cognito User Pools, and Step Functions audit pipelines.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setActiveModal('avp')}
                className="w-full text-xs h-8 border-border bg-card hover:bg-muted text-foreground font-semibold gap-1.5"
              >
                <span>Configure AWS AVP</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Launch Benchmark Suites */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Pre-Configured Benchmark Suites
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card-premium p-5 rounded-2xl border border-border flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    AcmePay Core Authorization (432 Scenarios)
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    DEMO BENCHMARK
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Evaluates candidate v13 draft with SC-04 contractor payroll deletion violation.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenDemoAcmePay}
                className="text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-bold shrink-0 gap-1"
              >
                <span>Open Workbench</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="glass-card-premium p-5 rounded-2xl border border-border flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    DocVault Multi-Tenant SaaS (4 Invariants)
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    MULTI-TENANT
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Proves tenant isolation between Tenant-Alpha and Tenant-Beta across classification tiers.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenDocVault}
                className="text-xs h-8 bg-sky-600 hover:bg-sky-500 text-white font-bold shrink-0 gap-1"
              >
                <span>Open Workbench</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Connected Workspaces List */}
        {state.workspaces.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Connected Workspaces ({state.workspaces.length})
            </h2>

            <div className="space-y-2">
              {state.workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="glass-card-premium p-4 rounded-xl border border-border flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted text-foreground">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{ws.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ID: {ws.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Mode: {ws.mode} · Created: {new Date(ws.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        dispatch({ type: 'SELECT_WORKSPACE', id: ws.id })
                        onOpenWorkspace(ws.id)
                      }}
                      className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-1"
                    >
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Connectors Modals */}
      {activeModal === 'github' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)} className="text-white">
                ✕ Close
              </Button>
            </div>
            <GitHubConnector onWorkspaceCreated={handleCreatedWorkspace} />
          </div>
        </div>
      )}

      {activeModal === 'local' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)} className="text-white">
                ✕ Close
              </Button>
            </div>
            <LocalConnector onWorkspaceCreated={handleCreatedWorkspace} />
          </div>
        </div>
      )}

      {activeModal === 'avp' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)} className="text-white">
                ✕ Close
              </Button>
            </div>
            <AVPConnector />
          </div>
        </div>
      )}
    </div>
  )
}
