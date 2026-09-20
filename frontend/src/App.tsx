import { ThemeProvider } from "@/theme/ThemeProvider"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar, ActiveTab } from "@/components/layout/AppSidebar"
import { OverviewScreen } from "@/features/overview/OverviewScreen"
import { PolicyEditorScreen } from "@/features/editor/PolicyEditorScreen"
import { SimulatorScreen } from "@/features/simulator/SimulatorScreen"
import { ChangeAnalysisScreen } from "@/features/changes/ChangeAnalysisScreen"
import { AuditScreen } from "@/features/audit/AuditScreen"
import { RegressionScreen } from "@/features/regression/RegressionScreen"
import { DeploymentScreen } from "@/features/deployment/DeploymentScreen"
import { LandingPage } from "@/features/landing/LandingPage"
import { HubConsole } from "@/features/hub/HubConsole"
import { WorkspaceProvider } from "@/store/WorkspaceProvider"
import { useWorkspace, DEMO_WORKSPACE } from "@/store/workspaceStore"
import { useAppRouter } from "@/lib/router"
import { DOCVAULT_WORKSPACE } from "@/fixtures/docvault"
import { handleCognitoRedirectCallback } from "@/lib/cognito"
import { useEffect } from "react"

// ─── Inner component: rendered inside WorkspaceProvider context ───────────────
function AppContent() {
  const { route, navigate } = useAppRouter()
  const { activeWorkspace, isDemoMode, dispatch } = useWorkspace()

  // Handle Cognito OAuth callback on initial mount
  useEffect(() => {
    const user = handleCognitoRedirectCallback()
    if (user && route.type === 'landing') {
      navigate({ type: 'console' })
    }
  }, [])

  // Handle benchmark launch from landing page
  const handleOpenBenchmark = (benchmark: 'acmepay' | 'docvault') => {
    if (benchmark === 'acmepay') {
      dispatch({ type: 'SELECT_WORKSPACE', id: DEMO_WORKSPACE.id })
      navigate({ type: 'workspace', workspaceId: 'demo', tab: 'overview' })
    } else {
      dispatch({ type: 'CREATE_WORKSPACE', workspace: DOCVAULT_WORKSPACE })
      dispatch({ type: 'SELECT_WORKSPACE', id: 'docvault-production' })
      navigate({ type: 'workspace', workspaceId: 'docvault-production', tab: 'overview' })
    }
  }

  // Handle opening workspace from Hub Console
  const handleOpenWorkspace = (workspaceId: string) => {
    navigate({ type: 'workspace', workspaceId, tab: 'overview' })
  }

  // Sync route changes with workspace selection if navigated directly via URL
  useEffect(() => {
    if (route.type === 'workspace') {
      if (route.workspaceId === 'demo' && !isDemoMode) {
        dispatch({ type: 'SELECT_WORKSPACE', id: DEMO_WORKSPACE.id })
      } else if (route.workspaceId !== 'demo' && activeWorkspace?.id !== route.workspaceId) {
        dispatch({ type: 'SELECT_WORKSPACE', id: route.workspaceId })
      }
    }
  }, [route, isDemoMode, activeWorkspace?.id, dispatch])

  // If on Landing Page route or no workspace active and hash is empty
  if (route.type === 'landing') {
    return (
      <LandingPage
        onEnterConsole={() => navigate({ type: 'console' })}
        onOpenBenchmark={handleOpenBenchmark}
      />
    )
  }

  // If on Console Hub route or no active workspace
  if (route.type === 'console' || (!activeWorkspace && route.type !== 'workspace')) {
    return (
      <HubConsole
        onOpenWorkspace={handleOpenWorkspace}
        onReturnToLanding={() => navigate({ type: 'landing' })}
      />
    )
  }

  // Active tab in workbench
  const currentTab: ActiveTab = route.type === 'workspace' ? route.tab : 'overview'

  const handleSelectTab = (tab: ActiveTab) => {
    const wsId = isDemoMode ? 'demo' : (activeWorkspace?.id || 'connected')
    navigate({ type: 'workspace', workspaceId: wsId, tab })
  }

  const renderActiveScreen = () => {
    switch (currentTab) {
      case "overview":
        return <OverviewScreen onNavigate={handleSelectTab} />
      case "policies":
        return <PolicyEditorScreen onNavigate={handleSelectTab} />
      case "simulator":
        return <SimulatorScreen />
      case "changes":
        return <ChangeAnalysisScreen />
      case "audit":
        return <AuditScreen />
      case "tests":
        return <RegressionScreen />
      case "deployments":
        return <DeploymentScreen />
      default:
        return <OverviewScreen onNavigate={handleSelectTab} />
    }
  }

  const projectName = isDemoMode ? "AcmePay / Authorization" : activeWorkspace?.name || "Connected Project"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden cyber-canvas-grid selection:bg-orange-500 selection:text-white">
      {/* Atmospheric Cyber Auroras */}
      <div className="fixed top-0 inset-x-0 h-[520px] cyber-aurora-top pointer-events-none z-0" />
      <div className="fixed top-[-100px] right-[-100px] h-[650px] w-[650px] cyber-aurora-corner pointer-events-none z-0" />
      <div className="fixed top-[35%] left-[-150px] h-[550px] w-[550px] cyber-aurora-left pointer-events-none z-0" />

      {/* Workbench Header — workspace-aware */}
      <AppHeader
        activeProject={projectName}
        activeVersion={isDemoMode ? "v12 (PROD)" : undefined}
        workspaceMode={isDemoMode ? "demo" : "connected"}
        onSwitchWorkspace={() => navigate({ type: 'console' })}
      />

      {/* Main Split Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full min-w-0 relative z-10">
        {/* Workspace Sidebar */}
        <AppSidebar
          activeTab={currentTab}
          onSelectTab={handleSelectTab}
          failedContractsCount={isDemoMode ? 3 : 0}
          counterexamplesCount={isDemoMode ? 3 : 0}
        />

        {/* Core Screen Workspace Area */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 min-w-0 overflow-y-auto max-w-7xl">
          {renderActiveScreen()}
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="policylab-ui-theme">
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </ThemeProvider>
  )
}

export default App
