import React, { useState, useRef, useEffect } from "react"
import Editor, { DiffEditor, Monaco } from "@monaco-editor/react"
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
  Database,
  Columns,
  ArrowLeftRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_SCHEMA,
} from "@/fixtures/acmepay"
import { ActiveTab } from "@/components/layout/AppSidebar"
import { validateCedarPolicy, PolicyValidationResponse } from "@/lib/api"
import { useWorkspace } from "@/store/workspaceStore"

interface PolicyEditorScreenProps {
  onNavigate: (tab: ActiveTab) => void
}

function configureCedarMonaco(monaco: Monaco) {
  if (!monaco.languages.getLanguages().some((l: any) => l.id === "cedar")) {
    monaco.languages.register({ id: "cedar" })
    monaco.languages.setMonarchTokensProvider("cedar", {
      keywords: [
        "permit",
        "forbid",
        "when",
        "unless",
        "in",
        "is",
        "has",
        "like",
        "principal",
        "action",
        "resource",
        "context",
        "true",
        "false",
        "if",
        "then",
        "else",
      ],
      typeKeywords: [
        "Action",
        "User",
        "Role",
        "Department",
        "Invoice",
        "PayrollReport",
        "Account",
        "CustomerRecord",
        "SupportTicket",
        "String",
        "Long",
        "Boolean",
        "Set",
        "Record",
        "Entity",
        "IPAddr",
        "Decimal",
      ],
      operators: [
        "==",
        "!=",
        "<=",
        ">=",
        "<",
        ">",
        "&&",
        "||",
        "!",
        "+",
        "-",
        "*",
        ".",
      ],
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      tokenizer: {
        root: [
          [
            /[a-z_$][\w$]*/,
            {
              cases: {
                "@keywords": "keyword",
                "@default": "identifier",
              },
            },
          ],
          [
            /[A-Z][\w$]*/,
            {
              cases: {
                "@typeKeywords": "type",
                "@default": "type.identifier",
              },
            },
          ],
          { include: "@whitespace" },
          [/[{}()\[\]]/, "@brackets"],
          [
            /@symbols/,
            {
              cases: {
                "@operators": "operator",
                "@default": "",
              },
            },
          ],
          [/\d+/, "number"],
          [/[;,.]/, "delimiter"],
          [/"([^"\\]|\\.)*"/, "string"],
        ],
        whitespace: [
          [/[ \t\r\n]+/, "white"],
          [/\/\/.*$/, "comment"],
        ],
      },
    })

    monaco.editor.defineTheme("policylab-cedar-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "f97316", fontStyle: "bold" },
        { token: "type.identifier", foreground: "38bdf8", fontStyle: "bold" },
        { token: "identifier", foreground: "e2e8f0" },
        { token: "string", foreground: "4ade80" },
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "number", foreground: "fb923c" },
        { token: "operator", foreground: "cbd5e1" },
      ],
      colors: {
        "editor.background": "#0c1017",
        "editor.foreground": "#e2e8f0",
        "editor.lineHighlightBackground": "#ffffff08",
        "editorCursor.foreground": "#f97316",
        "editorWhitespace.foreground": "#ffffff15",
        "editorIndentGuide.background": "#ffffff10",
        "editorIndentGuide.activeBackground": "#f9731640",
      },
    })
  }
}

export const PolicyEditorScreen: React.FC<PolicyEditorScreenProps> = ({
  onNavigate,
}) => {
  const { isDemoMode, activeWorkspace, connectedData, dispatch } = useWorkspace()

  // View Mode: 'single' editor vs 'compare' side-by-side diff
  const [viewMode, setViewMode] = useState<"single" | "compare">("single")
  const [renderSideBySide, setRenderSideBySide] = useState<boolean>(true)

  // Selected version key in single mode
  const [selectedVersion, setSelectedVersion] = useState<"baseline" | "candidate">("candidate")
  const [activeTab, setActiveTab] = useState<"code" | "schema">("code")

  // Compare mode version selectors
  const [compareLeftVersion, setCompareLeftVersion] = useState<"baseline" | "candidate">("baseline")
  const [compareRightVersion, setCompareRightVersion] = useState<"baseline" | "candidate">("candidate")

  // Code buffer
  const getInitialCode = (ver: "baseline" | "candidate") => {
    if (isDemoMode) {
      return ver === "baseline" ? POLICY_V12_TEXT : POLICY_V13_TEXT
    }
    return ver === "baseline"
      ? (connectedData?.baselinePolicyText || "")
      : (connectedData?.candidatePolicyText || "")
  }

  const [code, setCode] = useState(() => getInitialCode("candidate"))
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<PolicyValidationResponse | null>(null)
  const [valDurationMs, setValDurationMs] = useState<number | null>(null)

  const editorRef = useRef<any>(null)
  const diffEditorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)

  // Sync if workspace or version changes
  useEffect(() => {
    const freshCode = getInitialCode(selectedVersion)
    setCode(freshCode)
    setIsSaved(false)
    setValidationResult(null)
    setValDurationMs(null)
  }, [isDemoMode, activeWorkspace?.id, selectedVersion])

  const baselineLabel = isDemoMode ? "v12 (Production)" : (connectedData?.baselineLabel || "Baseline")
  const candidateLabel = isDemoMode ? "v13 (Candidate)" : (connectedData?.candidateLabel || "Candidate")
  const schemaDisplay = isDemoMode ? ACMEPAY_SCHEMA : (connectedData?.schemaText || "{\n  \"comment\": \"No schema defined for this workspace.\"\n}")

  const leftCompareCode = getInitialCode(compareLeftVersion)
  const rightCompareCode = getInitialCode(compareRightVersion)
  const leftCompareLabel = compareLeftVersion === "baseline" ? baselineLabel : candidateLabel
  const rightCompareLabel = compareRightVersion === "baseline" ? baselineLabel : candidateLabel

  const handleVersionChange = (ver: "baseline" | "candidate") => {
    setSelectedVersion(ver)
    const newCode = getInitialCode(ver)
    setCode(newCode)
    setIsSaved(false)
    setValidationResult(null)
    setValDurationMs(null)
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, "cedar-validation", [])
      }
    }
  }

  const handleValidate = async () => {
    setIsValidating(true)
    const start = performance.now()
    try {
      const res = await validateCedarPolicy(code)
      setValDurationMs(Math.round((performance.now() - start) * 10) / 10)
      setValidationResult(res)

      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel()
        if (model) {
          if (res.isValid) {
            monacoRef.current.editor.setModelMarkers(model, "cedar-validation", [])
          } else {
            const markers = res.errors.map((err) => {
              const lineMatch = err.message.match(/line\s+(\d+)/i)
              const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1
              return {
                startLineNumber: lineNum,
                startColumn: 1,
                endLineNumber: lineNum,
                endColumn: model.getLineMaxColumn(lineNum) || 120,
                message: err.message,
                severity: monacoRef.current!.MarkerSeverity.Error,
              }
            })
            monacoRef.current.editor.setModelMarkers(model, "cedar-validation", markers)
          }
        }
      }
    } catch (err: any) {
      setValDurationMs(Math.round((performance.now() - start) * 10) / 10)
      setValidationResult({
        isValid: false,
        errors: [{
          message: err.message || "Cedar validation request failed",
          severity: "error",
          sourceLocations: []
        }],
        warnings: [],
        engine: "Cedar WASM"
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeTab === "code" ? code : schemaDisplay)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (!isDemoMode && activeWorkspace) {
      if (selectedVersion === "candidate") {
        dispatch({
          type: "UPDATE_CONNECTED_DATA",
          id: activeWorkspace.id,
          patch: { candidatePolicyText: code }
        })
      } else {
        dispatch({
          type: "UPDATE_CONNECTED_DATA",
          id: activeWorkspace.id,
          patch: { baselinePolicyText: code }
        })
      }
    }
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      {/* Stale Warning Banner for Connected Workspaces */}
      {!isDemoMode && connectedData?.analysisStale && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Policy edits detected. Analysis results and approval states are now stale. Re-run analysis before verifying or deploying.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate("changes")}
            className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-300 shrink-0"
          >
            Re-run Analysis
          </Button>
        </div>
      )}

      {/* Top Editor Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">Cedar Engine v3.1</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">
              {viewMode === "compare" ? "Side-by-Side Policy Comparison" : "Deterministic AST Evaluation"}
            </span>
            {!isDemoMode && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {activeWorkspace?.name || "Connected"}
                </span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-orange-400" />
            Cedar Policy Engineering Workspace
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Single Editor vs Compare Side-by-Side */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/50 border border-white/[0.12] backdrop-blur-md">
            <button
              onClick={() => setViewMode("single")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "single"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setViewMode("compare")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "compare"
                  ? "bg-[#FF6A24] text-white shadow-[0_0_12px_rgba(255,106,36,0.4)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Compare</span>
            </button>
          </div>

          {viewMode === "single" ? (
            <>
              {/* Version Switcher Tabs in Single Mode */}
              <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
                <button
                  onClick={() => handleVersionChange("baseline")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedVersion === "baseline"
                      ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {baselineLabel}
                </button>
                <button
                  onClick={() => handleVersionChange("candidate")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedVersion === "candidate"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {candidateLabel}
                </button>
              </div>

              <Button
                size="sm"
                onClick={handleValidate}
                disabled={isValidating}
                className="gap-1.5 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all hover:scale-105"
              >
                {isValidating ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Validate AST</span>
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                className="gap-1.5 text-xs h-8 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-foreground transition-all hover:scale-105"
              >
                {isSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Compare Mode Side-by-Side vs Inline toggle */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRenderSideBySide(!renderSideBySide)}
                className="gap-1.5 text-xs h-8 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
              >
                <Columns className="h-3.5 w-3.5 text-sky-400" />
                <span>{renderSideBySide ? "Split View" : "Inline View"}</span>
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground transition-all hover:scale-105"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Blast Radius</span>
          </Button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className={`grid grid-cols-1 ${viewMode === "compare" ? "lg:grid-cols-1" : "lg:grid-cols-12"} gap-4`}>
        {/* Monaco Code / Diff Editor */}
        <div className={`${viewMode === "compare" ? "lg:col-span-1" : "lg:col-span-8"} space-y-3`}>
          <div className="glass-panel-premium rounded-2xl border border-white/[0.08] overflow-hidden">
            {/* Editor Sub-header / File tabs or Compare Selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-black/40 gap-2">
              {viewMode === "single" ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-md transition-all ${
                      activeTab === "code"
                        ? "bg-white/[0.08] text-foreground font-semibold border border-white/[0.06]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5 text-orange-400" />
                    <span>policy_{selectedVersion}.cedar</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("schema")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-md transition-all ${
                      activeTab === "schema"
                        ? "bg-white/[0.08] text-foreground font-semibold border border-white/[0.06]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Hash className="h-3.5 w-3.5 text-sky-400" />
                    <span>schema.json</span>
                  </button>
                </div>
              ) : (
                /* Compare Mode Version Selectors Header */
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg border border-white/[0.08]">
                    <span className="text-muted-foreground text-[11px] font-mono">Original (Left):</span>
                    <select
                      value={compareLeftVersion}
                      onChange={(e) => setCompareLeftVersion(e.target.value as "baseline" | "candidate")}
                      className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="baseline" className="bg-[#111622] text-white">
                        {baselineLabel}
                      </option>
                      <option value="candidate" className="bg-[#111622] text-white">
                        {candidateLabel}
                      </option>
                    </select>
                  </div>

                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/60" />

                  <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg border border-white/[0.08]">
                    <span className="text-muted-foreground text-[11px] font-mono">Modified (Right):</span>
                    <select
                      value={compareRightVersion}
                      onChange={(e) => setCompareRightVersion(e.target.value as "baseline" | "candidate")}
                      className="bg-transparent text-orange-400 font-medium text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="candidate" className="bg-[#111622] text-orange-400">
                        {candidateLabel}
                      </option>
                      <option value="baseline" className="bg-[#111622] text-white">
                        {baselineLabel}
                      </option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {viewMode === "single" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyCode}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400 mr-1" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                )}

                {viewMode === "compare" ? (
                  <Badge variant="allow" className="text-[10px] gap-1 font-mono bg-sky-500/10 text-sky-300 border-sky-500/20">
                    <GitCompare className="h-3 w-3" />
                    Diff Engine Active ({renderSideBySide ? "Split" : "Inline"})
                  </Badge>
                ) : validationResult ? (
                  validationResult.isValid ? (
                    <Badge variant="allow" className="text-[10px] gap-1 font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Cedar Validated ({validationResult.engine})
                    </Badge>
                  ) : (
                    <Badge variant="blocked" className="text-[10px] gap-1 font-mono bg-red-500/10 text-red-400 border-red-500/20">
                      <AlertTriangle className="h-3 w-3" />
                      Syntax Error ({validationResult.errors.length})
                    </Badge>
                  )
                ) : (
                  <Badge variant="allow" className="text-[10px] gap-1 font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Monaco Engine
                  </Badge>
                )}
              </div>
            </div>

            {/* Code Body Area with Monaco Editor or DiffEditor */}
            <div className="bg-[#0c1017]">
              {viewMode === "compare" ? (
                <div className="min-h-[520px]">
                  <DiffEditor
                    height="520px"
                    language="cedar"
                    theme="policylab-cedar-dark"
                    original={leftCompareCode}
                    modified={rightCompareCode}
                    beforeMount={configureCedarMonaco}
                    onMount={(diffEditor, monaco) => {
                      diffEditorRef.current = diffEditor
                      monacoRef.current = monaco
                    }}
                    options={{
                      readOnly: true,
                      renderSideBySide: renderSideBySide,
                      minimap: { enabled: false },
                      fontSize: 12.5,
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                      diffWordWrap: "on",
                      ignoreTrimWhitespace: false,
                    }}
                  />
                </div>
              ) : activeTab === "code" ? (
                <div className="min-h-[460px]">
                  <Editor
                    height="460px"
                    language="cedar"
                    theme="policylab-cedar-dark"
                    value={code}
                    beforeMount={configureCedarMonaco}
                    onMount={(editor, monaco) => {
                      editorRef.current = editor
                      monacoRef.current = monaco
                    }}
                    onChange={(value) => {
                      const updated = value || ""
                      setCode(updated)
                      setIsSaved(false)
                      if (!isDemoMode && activeWorkspace) {
                        dispatch({
                          type: "UPDATE_CONNECTED_DATA",
                          id: activeWorkspace.id,
                          patch: selectedVersion === "candidate"
                            ? { candidatePolicyText: updated }
                            : { baselinePolicyText: updated }
                        })
                      }
                      if (monacoRef.current && editorRef.current) {
                        const model = editorRef.current.getModel()
                        if (model) {
                          monacoRef.current.editor.setModelMarkers(model, "cedar-validation", [])
                        }
                      }
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12.5,
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                      renderLineHighlight: "all",
                      tabSize: 4,
                      folding: true,
                    }}
                  />
                </div>
              ) : (
                <div className="min-h-[460px]">
                  <Editor
                    height="460px"
                    language="json"
                    theme="vs-dark"
                    value={schemaDisplay}
                    options={{
                      readOnly: isDemoMode,
                      minimap: { enabled: false },
                      fontSize: 12.5,
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>
              )}
            </div>

            {/* Diagnostics Bar */}
            <div className="px-3.5 py-2.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                {viewMode === "compare" ? (
                  <div className="flex items-center gap-1.5 text-sky-300 font-medium">
                    <GitCompare className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <span>Comparing {leftCompareLabel} (left) against {rightCompareLabel} (right)</span>
                  </div>
                ) : validationResult ? (
                  !validationResult.isValid ? (
                    <div className="flex items-center gap-1.5 text-rose-400 font-medium truncate">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="truncate">Syntax Error: {validationResult.errors?.map((e) => e.message).join("; ") || "Invalid Cedar syntax"}</span>
                    </div>
                  ) : validationResult.warnings && validationResult.warnings.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-400 font-medium truncate">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{validationResult.warnings?.map((w) => w.message).join("; ")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Policy validated by Cedar WASM engine. Zero syntax errors.</span>
                    </div>
                  )
                ) : isDemoMode && selectedVersion === "candidate" ? (
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Line 18 & 24: Unrestricted action clause matches 4 schema actions.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Zero syntax diagnostics. Ready for evaluation.</span>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                {viewMode === "compare" ? "Monaco Diff · UTF-8" : validationResult ? `Cedar WASM · ${valDurationMs ?? 0.8}ms` : "UTF-8 · LF · Cedar Core"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Context & Diagnostics (4 cols, hidden in compare mode for full view) */}
        {viewMode === "single" && (
          <div className="lg:col-span-4 space-y-3">
            <Card className="glass-card-premium rounded-2xl">
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
                  <Badge variant={selectedVersion === "candidate" ? "blocked" : "allow"} className="font-mono text-[10px]">
                    {selectedVersion === "candidate" ? candidateLabel : baselineLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-mono text-muted-foreground">
                    {isDemoMode ? "Benchmark Fixture" : `Connected (${connectedData?.importSource || "MANUAL"})`}
                  </span>
                </div>
                {connectedData?.sourceRef && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Source:</span>
                    <span className="font-mono text-muted-foreground truncate max-w-[140px]" title={connectedData.sourceRef}>
                      {connectedData.sourceRef}
                    </span>
                  </div>
                )}
              </div>

              {isDemoMode && selectedVersion === "candidate" ? (
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
              ) : isDemoMode ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Production Baseline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Active policy set in Amazon Verified Permissions.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span>Connected Policy</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Deterministic evaluation via local Cedar WASM engine.
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
                  onClick={() => onNavigate("changes")}
                  className="w-full text-xs justify-start gap-1.5 h-7 border-white/[0.08] hover:bg-white/[0.05]"
                >
                  <GitCompare className="h-3 w-3 text-orange-400" />
                  Run Diff Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  )
}

