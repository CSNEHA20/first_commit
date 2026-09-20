/**
 * Local Project Connector Card
 *
 * Implements genuine in-browser file and folder import using the HTML5 File API.
 * Discovers and validates .cedar policies, JSON schemas, entities, and scenarios
 * directly from the developer's workstation without sending data to external servers.
 *
 * Also provides the standalone CLI specification for CI/CD environments.
 */

import React, { useState, useRef } from "react"
import { Terminal, FolderOpen, AlertTriangle, CheckCircle2, FileCode, Database, Shield, ListChecks, Upload, Copy, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Workspace, DEFAULT_CONNECTED_DATA, ConnectedWorkspaceData } from "@/store/workspaceStore"
import { Scenario } from "@/types/authz"

interface LocalConnectorProps {
  onWorkspaceCreated?: (ws: Workspace) => void
}

interface DiscoveredLocalFile {
  name: string
  size: number
  type: "policy" | "schema" | "entities" | "scenarios" | "other"
  content: string
}

export const LocalConnector: React.FC<LocalConnectorProps> = ({ onWorkspaceCreated }) => {
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredLocalFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedCli, setCopiedCli] = useState(false)
  const [importedWorkspace, setImportedWorkspace] = useState<Workspace | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setError(null)
    setDiscoveredFiles([])
    setImportedWorkspace(null)

    const loaded: DiscoveredLocalFile[] = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const nameLower = file.name.toLowerCase()

      // Only read Cedar and JSON files to avoid loading large unrelated files
      if (!nameLower.endsWith(".cedar") && !nameLower.endsWith(".json")) {
        continue
      }

      if (file.size > 1024 * 1024) {
        setError(`File '${file.name}' exceeds 1MB limit.`)
        continue
      }

      try {
        const text = await file.text()
        let fileType: DiscoveredLocalFile["type"] = "other"
        if (nameLower.endsWith(".cedar")) {
          fileType = "policy"
        } else if (nameLower.includes("schema") && nameLower.endsWith(".json")) {
          fileType = "schema"
        } else if (nameLower.includes("entit") && nameLower.endsWith(".json")) {
          fileType = "entities"
        } else if (nameLower.includes("scenario") && nameLower.endsWith(".json")) {
          fileType = "scenarios"
        }

        loaded.push({
          name: file.name,
          size: file.size,
          type: fileType,
          content: text,
        })
      } catch (err: any) {
        setError(`Failed to read '${file.name}': ${err.message}`)
      }
    }

    if (loaded.length === 0) {
      setError("No valid .cedar or .json files found in selection.")
      return
    }

    setDiscoveredFiles(loaded)

    // Build connected workspace
    const policyFiles = loaded.filter((f) => f.type === "policy")
    const schemaFile = loaded.find((f) => f.type === "schema")
    const entitiesFile = loaded.find((f) => f.type === "entities")
    const scenariosFile = loaded.find((f) => f.type === "scenarios")

    const baselineFile = policyFiles.find((f) => f.name.includes("baseline")) || policyFiles[0]
    const candidateFile = policyFiles.find((f) => f.name.includes("candidate")) || policyFiles[1] || baselineFile

    let parsedScenarios: Scenario[] = []
    if (scenariosFile?.content) {
      try {
        const p = JSON.parse(scenariosFile.content)
        if (Array.isArray(p)) {
          parsedScenarios = p
        } else if (p.scenarios && Array.isArray(p.scenarios)) {
          parsedScenarios = p.scenarios
        }
      } catch {
        // ignore parse error
      }
    }

    const connected: ConnectedWorkspaceData = {
      ...DEFAULT_CONNECTED_DATA,
      baselinePolicyText: baselineFile?.content || "",
      baselineLabel: baselineFile?.name ? `Local: ${baselineFile.name}` : "Baseline",
      candidatePolicyText: candidateFile?.content || baselineFile?.content || "",
      candidateLabel: candidateFile?.name ? `Local: ${candidateFile.name}` : "Candidate",
      schemaText: schemaFile?.content || "",
      entitiesJson: entitiesFile?.content || "",
      scenarios: parsedScenarios,
      importSource: "LOCAL_CLI",
      sourceRef: `local://${baselineFile?.name || "policies"}`,
    }

    const newWorkspace: Workspace = {
      id: `ws_local_${Date.now()}`,
      mode: "connected",
      name: `Local: ${baselineFile?.name?.replace(/\.cedar$/, "") || "Project"}`,
      createdAt: new Date().toISOString(),
      connected,
    }

    setImportedWorkspace(newWorkspace)
  }

  const handleCopyCli = () => {
    const cmd = "policylab verify --policy ./authz/candidate.cedar --baseline ./authz/baseline.cedar --schema ./authz/schema.json --scenarios ./tests/scenarios.json"
    navigator.clipboard.writeText(cmd)
    setCopiedCli(true)
    setTimeout(() => setCopiedCli(false), 2000)
  }

  return (
    <Card className="glass-card-premium rounded-2xl border border-white/[0.08]">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          Local Project & CLI Connector
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            LOCAL IN-BROWSER + CLI
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3 text-xs text-muted-foreground">
        <p className="text-[11px]">
          Import Cedar policies, schema, and scenarios directly from your workstation's disk.
          Files are parsed in-browser and kept within your local session.
        </p>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".cedar,.json"
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs h-8 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            <span>Select Local Files</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            className="gap-1.5 text-xs h-8 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          >
            <FolderOpen className="h-3.5 w-3.5 text-sky-400" />
            <span>Select Project Folder</span>
          </Button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Loaded files */}
        {discoveredFiles.length > 0 && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Loaded {discoveredFiles.length} file{discoveredFiles.length !== 1 ? "s" : ""} from workstation
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Local Session</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {discoveredFiles.map((f) => (
                <div key={f.name} className="p-1.5 rounded bg-black/40 border border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    {f.type === "policy" && <FileCode className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                    {f.type === "schema" && <Database className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                    {f.type === "entities" && <Shield className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
                    {f.type === "scenarios" && <ListChecks className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                    <span className="truncate text-foreground">{f.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                    {Math.round(f.size / 1024 * 10) / 10} KB
                  </span>
                </div>
              ))}
            </div>

            {importedWorkspace && onWorkspaceCreated && (
              <Button
                onClick={() => onWorkspaceCreated(importedWorkspace)}
                size="sm"
                className="w-full mt-2 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Open Connected Workspace ({importedWorkspace.name})</span>
              </Button>
            )}
          </div>
        )}

        {/* Standalone CLI Section */}
        <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground/80 font-mono">CI/CD Terminal CLI:</span>
            <button
              onClick={handleCopyCli}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {copiedCli ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedCli ? "Copied" : "Copy command"}
            </button>
          </div>
          <div className="p-2 rounded bg-black/50 border border-white/[0.06] font-mono text-[10px] text-emerald-400 overflow-x-auto">
            <p>policylab verify \</p>
            <p className="ml-4">--policy ./authz/candidate.cedar \</p>
            <p className="ml-4">--baseline ./authz/baseline.cedar \</p>
            <p className="ml-4">--schema ./authz/schema.json \</p>
            <p className="ml-4">--scenarios ./tests/scenarios.json</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
