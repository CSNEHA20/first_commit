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
import { useState } from "react"
import { WorkspaceProvider } from "@/store/WorkspaceProvider"
import { WorkspaceSelector } from "@/features/workspace/WorkspaceSelector"
import { useWorkspace } from "@/store/workspaceStore"

// ─── Inner component: rendered inside WorkspaceProvider context ───────────────
function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview")
  const { activeWorkspace, isDemoMode, dispatch } = useWorkspace()

  // Show workspace selector when no workspace is active
  if (!activeWorkspace) {
    return <WorkspaceSelector />
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewScreen onNavigate={setActiveTab} />
      case "policies":
        return <PolicyEditorScreen onNavigate={setActiveTab} />
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
        return <OverviewScreen onNavigate={setActiveTab} />
    }
  }

  const projectName = isDemoMode ? "AcmePay / Authorization" : activeWorkspace.name

  return (
    <div className="min-h-screen bg-[#090A0D] text-foreground flex flex-col font-sans relative overflow-x-hidden cyber-canvas-grid">
      {/* Multi-layer Atmospheric Cyber Auroras */}
      <div className="fixed top-0 inset-x-0 h-[520px] cyber-aurora-top pointer-events-none z-0" />
      <div className="fixed top-[-100px] right-[-100px] h-[650px] w-[650px] cyber-aurora-corner pointer-events-none z-0" />
      <div className="fixed top-[35%] left-[-150px] h-[550px] w-[550px] cyber-aurora-left pointer-events-none z-0" />

      {/* Workbench Header — workspace-aware */}
      <AppHeader
        activeProject={projectName}
        activeVersion={isDemoMode ? "v12 (PROD)" : undefined}
        workspaceMode={isDemoMode ? "demo" : "connected"}
        onSwitchWorkspace={() => dispatch({ type: "SHOW_WORKSPACE_SELECTOR" })}
      />

      {/* Main Split Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full min-w-0 relative z-10">
        {/* Workspace Sidebar */}
        <AppSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
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
