import React, { useState } from "react"
import { GitBranch, FolderGit2, AlertTriangle, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface GitHubConnectorProps {
  onImport?: (repoUrl: string, branch: string, path: string) => void
}

export const GitHubConnector: React.FC<GitHubConnectorProps> = ({ onImport }) => {
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [path, setPath] = useState("policies")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!repoUrl.trim()) {
      setError("Repository URL is required.")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      if (onImport) {
        onImport(repoUrl, branch, path)
      }
    } catch (err: any) {
      setError(err.message || "Failed to import from GitHub.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="glass-card-premium border-white/[0.08] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-5 w-5 text-orange-400" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">GitHub Policy Repository</h3>
          <p className="text-xs text-muted-foreground">Import Cedar policies, schema, and tests directly from a Git repository.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Repository URL</label>
          <Input
            placeholder="https://github.com/org/cedar-policies"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="text-xs font-mono bg-black/40 border-white/[0.08]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch</label>
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
              placeholder="policies"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="text-xs font-mono bg-black/40 border-white/[0.08]"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={isLoading}
          size="sm"
          className="w-full gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
          <span>Fetch Repository Policies</span>
        </Button>
      </div>
    </Card>
  )
}
