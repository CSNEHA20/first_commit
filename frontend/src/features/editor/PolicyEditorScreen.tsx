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
  Hash,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">Cedar Engine v3.1</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">Deterministic AST Evaluation</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-orange-400" />
            Cedar Policy Engineering Workspace
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => handleVersionChange("v12")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => handleVersionChange("v13")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate Draft)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="text-xs gap-1 h-7 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
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
            className="text-xs gap-1 h-7 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-medium shadow-[0_0_15px_rgba(255,106,36,0.3)]"
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
          <div className="rounded-xl border border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md overflow-hidden shadow-2xl">
            {/* Editor Sub-Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-black/40 text-xs">
              <div className="flex items-center gap-2">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="h-6 bg-white/[0.05] border border-white/[0.08]">
                    <TabsTrigger value="code" className="text-xs h-5 px-2.5 font-mono text-muted-foreground data-[state=active]:text-white data-[state=active]:bg-white/[0.1]">
                      policy.cedar
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs h-5 px-2.5 font-mono text-muted-foreground data-[state=active]:text-white data-[state=active]:bg-white/[0.1]">
                      schema.json
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {lineCount} lines
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="allow" className="text-[10px] gap-1 font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  AST Valid
                </Badge>
              </div>
            </div>

            {/* Code Body Area */}
            <div>
              {activeTab === "code" ? (
                <div className="flex bg-[#090A0D]/70 font-mono text-xs leading-relaxed overflow-x-auto min-h-[460px]">
                  {/* Line Numbers */}
                  <div className="py-3 px-2.5 select-none text-right text-muted-foreground/30 border-r border-white/[0.08] bg-black/20 w-11 shrink-0 text-[11px]">
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-5 leading-5 ${
                          selectedVersion === "v13" && (i + 1 === 18 || i + 1 === 24)
                            ? "text-orange-400 font-bold"
                            : ""
                        }`}
                      >
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
                    className="w-full p-3 bg-transparent resize-none outline-none font-mono text-xs leading-5 text-foreground selection:bg-orange-500/30 whitespace-pre focus:ring-0"
                    rows={lineCount + 2}
                  />
                </div>
              ) : (
                <div className="p-3 bg-[#090A0D]/70 font-mono text-xs leading-relaxed overflow-x-auto min-h-[460px]">
                  <pre className="text-muted-foreground">{ACMEPAY_SCHEMA}</pre>
                </div>
              )}
            </div>

            {/* Diagnostics Bar */}
            <div className="px-3 py-2 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {selectedVersion === "v13" ? (
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Line 18 & 24: Unrestricted action clause matches 4 schema actions.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Policy set satisfies all schema constraints. Zero diagnostics.</span>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono">
                UTF-8 · LF · Cedar Core
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Context & Diagnostics (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
            <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-orange-400" />
                Policy Context & Provenance
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3.5 pt-2 space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <Badge variant={selectedVersion === "v13" ? "blocked" : "allow"} className="font-mono text-[10px]">
                    {selectedVersion}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SHA-256:</span>
                  <span className="font-mono text-muted-foreground truncate max-w-[140px]">
                    {selectedVersion === "v13" ? "f4219a8...fa12" : "8a3e77f...91bc"}
                  </span>
                </div>
              </div>

              {selectedVersion === "v13" ? (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Broadened Action Scope</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Naked <code className="font-mono text-orange-400 font-semibold">action</code> wildcard permits contractor delete/export operations (+3 actions, +184 resources).
                  </p>
                  <Button
                    onClick={() => onNavigate("changes")}
                    size="sm"
                    className="w-full text-xs font-medium gap-1 h-7 mt-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                  >
                    <GitCompare className="h-3 w-3" />
                    Inspect Behavioral Diff
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Production Baseline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Active policy set in Amazon Verified Permissions.
                  </p>
                </div>
              )}

              <Separator className="bg-white/[0.08]" />

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
                  Contextual Actions
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("simulator")}
                  className="w-full text-xs justify-start gap-1.5 h-7 border-white/[0.08] hover:bg-white/[0.05]"
                >
                  <Play className="h-3 w-3 text-amber-400" />
                  Simulate Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("tests")}
                  className="w-full text-xs justify-start gap-1.5 h-7 border-white/[0.08] hover:bg-white/[0.05]"
                >
                  <Code2 className="h-3 w-3 text-orange-400" />
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
