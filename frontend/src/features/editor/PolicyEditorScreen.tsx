import React, { useState } from "react"
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  GitCompare,
  Copy,
  Check,
  Code2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_SCHEMA,
} from "@/fixtures/acmepay"
import { ActiveTab } from "@/components/layout/AppSidebar"

interface PolicyEditorScreenProps {
  onNavigate: (tab: ActiveTab) => void
}

export const PolicyEditorScreen: React.FC<PolicyEditorScreenProps> = ({
  onNavigate,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [activeTab, setActiveTab] = useState<"code" | "schema">("code")
  const [code, setCode] = useState(
    selectedVersion === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT
  )
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const handleVersionChange = (ver: "v12" | "v13") => {
    setSelectedVersion(ver)
    setCode(ver === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT)
    setIsSaved(false)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const lineCount = code.split("\n").length

  return (
    <div className="space-y-4">
      {/* Top Editor Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">Cedar Engine v3.1</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">Deterministic Evaluation</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-muted-foreground" />
            Cedar Policy Editor
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher Tabs */}
          <div className="flex items-center p-0.5 rounded-md bg-muted border border-border">
            <button
              onClick={() => handleVersionChange("v12")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => handleVersionChange("v13")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="text-xs gap-1 h-7"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-status-allow" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs gap-1 h-7 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            <Save className="h-3 w-3" />
            <span>{isSaved ? "Saved" : "Save Version"}</span>
          </Button>
        </div>
      </div>

      {/* Editor & Context Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Code Surface (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="rounded-md border border-border bg-card overflow-hidden">
            {/* Editor Sub-Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 text-xs">
              <div className="flex items-center gap-2">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="h-6 bg-background">
                    <TabsTrigger value="code" className="text-xs h-5 px-2 font-mono">
                      policy.cedar
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs h-5 px-2 font-mono">
                      schema.json
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {lineCount} lines
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="allow" className="text-[10px] gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3" />
                  AST Valid
                </Badge>
              </div>
            </div>

            {/* Code Body Area */}
            <div>
              {activeTab === "code" ? (
                <div className="flex bg-muted/10 font-mono text-xs leading-relaxed overflow-x-auto min-h-[460px]">
                  {/* Line Numbers */}
                  <div className="py-3 px-2.5 select-none text-right text-muted-foreground/40 border-r border-border bg-muted/20 w-10 shrink-0 text-[11px]">
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div key={i} className="h-5 leading-5">
                        {i + 1}
                      </div>
                    ))}
                  </div>

                  {/* Textarea Code Input */}
                  <textarea
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setIsSaved(false)
                    }}
                    spellCheck={false}
                    className="w-full p-3 bg-transparent resize-none outline-none font-mono text-xs leading-5 text-foreground selection:bg-primary/20 whitespace-pre"
                    rows={lineCount + 2}
                  />
                </div>
              ) : (
                <div className="p-3 bg-muted/10 font-mono text-xs leading-relaxed overflow-x-auto min-h-[460px]">
                  <pre className="text-muted-foreground">{ACMEPAY_SCHEMA}</pre>
                </div>
              )}
            </div>

            {/* Diagnostics Bar */}
            <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {selectedVersion === "v13" ? (
                  <div className="flex items-center gap-1.5 text-status-warning font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Line 18 & 24: Unrestricted action clause matches 4 schema actions.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-status-allow font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Policy set satisfies all schema constraints. Zero diagnostics.</span>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono">
                UTF-8 · LF · Cedar
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Context & Diagnostics (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="border-border bg-card">
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-xs font-semibold">Policy Context</CardTitle>
            </CardHeader>

            <CardContent className="p-3.5 pt-1 space-y-3 text-xs">
              <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <Badge variant={selectedVersion === "v13" ? "blocked" : "allow"} className="font-mono text-[10px]">
                    {selectedVersion}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SHA-256:</span>
                  <span className="font-mono text-muted-foreground truncate max-w-[120px]">
                    {selectedVersion === "v13" ? "f4219a8...fa12" : "8a3e77f...91bc"}
                  </span>
                </div>
              </div>

              {selectedVersion === "v13" ? (
                <div className="p-2.5 rounded bg-status-blocked/10 border border-status-blocked/20 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-status-deny font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Broadened Action Scope</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Naked <code className="font-mono text-foreground font-semibold">action</code> wildcard permits contractor delete/export operations (+3 actions, +184 resources).
                  </p>
                  <Button
                    onClick={() => onNavigate("changes")}
                    variant="deny"
                    size="sm"
                    className="w-full text-xs font-medium gap-1 h-7 mt-1"
                  >
                    <GitCompare className="h-3 w-3" />
                    Inspect Behavioral Diff
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 rounded bg-status-allow/10 border border-status-allow/20 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-status-allow font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Production Baseline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Active policy set in Amazon Verified Permissions.
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Actions
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("simulator")}
                  className="w-full text-xs justify-start gap-1.5 h-7"
                >
                  <Play className="h-3 w-3 text-status-warning" />
                  Simulate Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("tests")}
                  className="w-full text-xs justify-start gap-1.5 h-7"
                >
                  <Code2 className="h-3 w-3 text-primary" />
                  Run Security Contracts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
