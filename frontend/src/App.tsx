import { useState } from "react"
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

export function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview")

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* Workbench Titlebar Header */}
      <AppHeader
        activeProject="AcmePay / Authorization"
        activeVersion="v12 (PROD)"
      />

      {/* Main Split Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row w-full min-w-0">
        {/* Workspace Sidebar */}
        <AppSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          failedContractsCount={3}
          counterexamplesCount={3}
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
    <ThemeProvider defaultTheme="light" storageKey="policylab-ui-theme">
      <AppContent />
    </ThemeProvider>
  )
}

export default App
