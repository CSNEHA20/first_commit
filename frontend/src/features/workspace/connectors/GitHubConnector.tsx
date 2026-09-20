/**
 * GitHub Policy Repository Connector
 * Connects directly to GitHub REST API to discover, fetch, and import
 * Cedar authorization policies, schemas, and scenario suites.
 *
 * Provenance: github://<owner>/<repo>@<branch>/<path>
 * Security: Credentials (optional PAT) are held only in component memory and never logged or persisted.
 */

import React, { useState } from "react"
import { GitBranch, FolderGit2, AlertTriangle, Loader2, CheckCircle2, FileCode, Database, ListChecks, Shield, Key } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Workspace, DEFAULT_CONNECTED_DATA, ConnectedWorkspaceData } from "@/store/workspaceStore"
import { Scenario } from "@/types/authz"

interface DiscoveredFile {
  name: string
  path: string
  downloadUrl: string
  size: number
  type: "policy" | "schema" | "entities" | "scenarios" | "other"
  content?: string
}

interface GitHubConnectorProps {
  onWorkspaceCreated?: (ws: Workspace) => void
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\/+$/, "")
  const match = trimmed.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/)
  if (match) {
    const repo = match[2].replace(/\.git$/, "")
    return { owner: match[1], repo }
  }
  // Also support "owner/repo" shorthand
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, "") }
  }
  return null
}

export const GitHubConnector: React.FC<GitHubConnectorProps> = ({ onWorkspaceCreated }) => {
  const [repoUrl, setRepoUrl] = useState("https://github.com/Vishallakshmikanthan/policylab")
  const [branch, setBranch] = useState("main")
  const [path, setPath] = useState("fixtures/docvault")
  const [patToken, setPatToken] = useState("")
  const [showPatInput, setShowPatInput] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFile[]>([])
  const [importedWorkspace, setImportedWorkspace] = useState<Workspace | null>(null)

  const handleFetch = async () => {
    const parsed = parseGitHubUrl(repoUrl)
    if (!parsed) {
      setError("Invalid GitHub repository URL. Format: https://github.com/owner/repo or owner/repo")
      return
    }

    setError(null)
    setIsLoading(true)
    setDiscoveredFiles([])
    setImportedWorkspace(null)

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    }
    if (patToken.trim()) {
      headers.Authorization = `Bearer ${patToken.trim()}`
    }

    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "")
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${cleanPath}?ref=${encodeURIComponent(
      branch.trim() || "main"
    )}`

    try {
      const response = await fetch(apiUrl, { headers })

      if (response.status === 404) {
        throw new Error(
          `Directory or repository not found at '${parsed.owner}/${parsed.repo}/${cleanPath}' (branch: ${branch}). Please verify repository visibility, branch name, and directory path.`
        )
      }
      if (response.status === 403) {
        const rateLimitMsg = response.headers.get("x-ratelimit-remaining") === "0"
          ? "GitHub API rate limit exceeded. Provide a Personal Access Token (PAT) below to continue."
          : "Access denied. For private repositories, please supply a GitHub Personal Access Token."
        throw new Error(rateLimitMsg)
      }
      if (!response.ok) {
        throw new Error(`GitHub API request failed with status HTTP ${response.status}: ${response.statusText}`)
      }

      const items = await response.json()
      if (!Array.isArray(items)) {
        throw new Error("Specified path is a single file, not a directory. Please provide a directory containing Cedar artifacts.")
      }

      const candidates: DiscoveredFile[] = []
      for (const item of items) {
        if (item.type === "file") {
          const nameLower = item.name.toLowerCase()
          let fileType: DiscoveredFile["type"] = "other"
          if (nameLower.endsWith(".cedar")) {
            fileType = "policy"
          } else if (nameLower.includes("schema") && nameLower.endsWith(".json")) {
            fileType = "schema"
          } else if (nameLower.includes("entit") && nameLower.endsWith(".json")) {
            fileType = "entities"
          } else if (nameLower.includes("scenario") && nameLower.endsWith(".json")) {
            fileType = "scenarios"
          }

          if (fileType !== "other" || nameLower.endsWith(".json") || nameLower.endsWith(".cedar")) {
            candidates.push({
              name: item.name,
              path: item.path,
              downloadUrl: item.download_url,
              size: item.size,
              type: fileType,
            })
          }
        }
      }

      if (candidates.length === 0) {
        throw new Error(`No Cedar policy (.cedar) or configuration (.json) files found in directory '${cleanPath}'.`)
      }

      // Fetch file contents
      const loaded: DiscoveredFile[] = await Promise.all(
        candidates.map(async (f) => {
          try {
            const rawRes = await fetch(f.downloadUrl, { headers: patToken.trim() ? { Authorization: `Bearer ${patToken.trim()}` } : {} })
            if (rawRes.ok) {
              const content = await rawRes.text()
              return { ...f, content }
            }
          } catch {
            // keep without content
          }
          return f
        })
      )

      setDiscoveredFiles(loaded)

      // Auto-synthesize connected workspace
      const policyFiles = loaded.filter((f) => f.type === "policy" && f.content)
      const schemaFile = loaded.find((f) => f.type === "schema" && f.content)
      const entitiesFile = loaded.find((f) => f.type === "entities" && f.content)
      const scenariosFile = loaded.find((f) => f.type === "scenarios" && f.content)

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
        baselineLabel: baselineFile?.name ? `Git: ${baselineFile.name}` : "Baseline",
        candidatePolicyText: candidateFile?.content || baselineFile?.content || "",
        candidateLabel: candidateFile?.name ? `Git: ${candidateFile.name}` : "Candidate",
        schemaText: schemaFile?.content || "",
        entitiesJson: entitiesFile?.content || "",
        scenarios: parsedScenarios,
        importSource: "GITHUB",
        sourceRef: `github://${parsed.owner}/${parsed.repo}@${branch}/${cleanPath}`,
      }

      const newWorkspace: Workspace = {
        id: `ws_gh_${Date.now()}`,
        mode: "connected",
        name: `${parsed.repo} (${cleanPath || "root"})`,
        createdAt: new Date().toISOString(),
        connected,
      }

      setImportedWorkspace(newWorkspace)
    } catch (err: any) {
      setError(err.message || "Failed to fetch from GitHub.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWorkspace = () => {
    if (importedWorkspace && onWorkspaceCreated) {
      onWorkspaceCreated(importedWorkspace)
    }
  }

  return (
    <Card className="glass-card-premium border-white/[0.08] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-orange-400" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">GitHub Policy Repository</h3>
            <p className="text-xs text-muted-foreground">Import Cedar policies, schema, and tests directly from a Git repository.</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono border-orange-500/30 text-orange-400">
          GENUINE API
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Repository URL or owner/repo</label>
          <Input
            placeholder="https://github.com/Vishallakshmikanthan/policylab"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="text-xs font-mono bg-black/40 border-white/[0.08]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch / Tag</label>
            <Input
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="text-xs font-mono bg-black/40 border-white/[0.08]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Directory Path</label>
            <Input
              placeholder="fixtures/docvault"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="text-xs font-mono bg-black/40 border-white/[0.08]"
            />
          </div>
        </div>

        {/* Optional PAT Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setShowPatInput(!showPatInput)}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground flex items-center gap-1 font-mono transition-colors"
          >
            <Key className="h-3 w-3" />
            {showPatInput ? "Hide Private Access Token" : "Private Repository? Add Token (Optional)"}
          </button>
          {showPatInput && (
            <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
              <label className="text-[10px] text-muted-foreground block">
                Personal Access Token (fine-grained or classic with <code className="text-orange-400">read</code> permissions)
              </label>
              <Input
                type="password"
                placeholder="ghp_..."
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                className="text-xs font-mono bg-black/60 border-white/[0.08] h-8"
              />
              <p className="text-[9px] text-muted-foreground/50">
                Security guarantee: Token is held strictly in component memory and never stored in localStorage or sent to backend.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleFetch}
          disabled={isLoading}
          size="sm"
          className="w-full gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
          <span>{isLoading ? "Querying GitHub API..." : "Fetch Repository Policies"}</span>
        </Button>

        {/* Discovered Files Summary */}
        {discoveredFiles.length > 0 && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Retrieved {discoveredFiles.length} Cedar artifacts</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Provenance: github://{parseGitHubUrl(repoUrl)?.owner}/{parseGitHubUrl(repoUrl)?.repo}@{branch}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {discoveredFiles.map((f) => (
                <div key={f.path} className="p-1.5 rounded bg-black/40 border border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
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
                onClick={handleCreateWorkspace}
                size="sm"
                className="w-full mt-2 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Open Connected Workspace ({importedWorkspace.name})</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
