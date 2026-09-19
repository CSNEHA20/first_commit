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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-indigo-500" />
            Cedar Policy Editor
          </h1>
          <p className="text-xs text-muted-foreground">
            Author and validate Cedar authorization policies against your application schema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Selector Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-muted border border-border">
            <button
              onClick={() => handleVersionChange("v12")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => handleVersionChange("v13")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft / Buggy)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="text-xs gap-1.5 h-8"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 h-8 font-semibold shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaved ? "Saved!" : "Save Version"}
          </Button>
        </div>
      </div>

      {/* Editor & Impact Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Monaco Code Editor & Diagnostics (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40 text-xs">
              <div className="flex items-center gap-2">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="h-7 bg-background">
                    <TabsTrigger value="code" className="text-xs h-6 px-2.5">
                      policy.cedar
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs h-6 px-2.5">
                      acmepay.cedarschema.json
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {lineCount} lines
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="allow" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Cedar v3.1 Syntax OK
                </Badge>
              </div>
            </div>

            <CardContent className="p-0">
              {activeTab === "code" ? (
                <div className="flex bg-muted/20 font-mono text-xs leading-relaxed overflow-x-auto min-h-[420px]">
                  {/* Line Numbers */}
                  <div className="p-4 pr-3 select-none text-right text-muted-foreground/50 border-r border-border bg-muted/30 w-12 shrink-0">
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div key={i} className="h-5 leading-5 font-mono text-[11px]">
                        {i + 1}
                      </div>
                    ))}
                  </div>

                  {/* Code Text Area with Line-Highlighting Mock */}
                  <textarea
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setIsSaved(false)
                    }}
                    spellCheck={false}
                    className="w-full p-4 bg-transparent resize-none outline-none font-mono text-xs leading-5 text-foreground selection:bg-indigo-500/30 whitespace-pre"
                    rows={lineCount + 2}
                  />
                </div>
              ) : (
                <div className="p-4 bg-muted/20 font-mono text-xs leading-relaxed overflow-x-auto min-h-[420px]">
                  <pre className="text-muted-foreground">{ACMEPAY_SCHEMA}</pre>
                </div>
              )}
            </CardContent>

            {/* Diagnostics Bar */}
            <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {selectedVersion === "v13" ? (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Line 18: Unrestricted action clause matched 4 schema actions.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Policy set satisfies all schema constraints. Zero diagnostics.</span>
                  </div>
                )}
              </div>

              <span className="text-[11px] text-muted-foreground font-mono">
                UTF-8 | LF | Cedar
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Policy Impact & Version Info (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-indigo-500" />
                Policy Impact Analysis
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Baseline Version:</span>
                  <Badge variant="outline" className="font-mono">v12</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Proposed Version:</span>
                  <Badge variant="blocked" className="font-mono">{selectedVersion}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SHA-256 Hash:</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {selectedVersion === "v13" ? "f4219a8...fa12" : "8a3e77f...91bc"}
                  </span>
                </div>
              </div>

              {selectedVersion === "v13" ? (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-500 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>High Authorization Blast Radius</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Modifying the action clause unintentionally granted destructive permissions (+3 actions, +184 resources).
                  </p>
                  <Button
                    onClick={() => onNavigate("changes")}
                    variant="deny"
                    size="sm"
                    className="w-full text-xs font-semibold gap-1.5 mt-2"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Inspect Behavioral Diff
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Production Baseline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This version is currently active in Amazon Verified Permissions.
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Quick Actions
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("simulator")}
                  className="w-full text-xs justify-start gap-2"
                >
                  <Play className="h-3.5 w-3.5 text-amber-500" />
                  Simulate Ad-hoc Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("tests")}
                  className="w-full text-xs justify-start gap-2"
                >
                  <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                  Run Regression Contracts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
