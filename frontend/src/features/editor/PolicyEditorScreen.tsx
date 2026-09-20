import React, { useState, useRef } from "react"
import Editor, { Monaco } from "@monaco-editor/react"
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
import { Separator } from "@/components/ui/separator"
import {
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_SCHEMA,
} from "@/fixtures/acmepay"
import { ActiveTab } from "@/components/layout/AppSidebar"
import { validateCedarPolicy, PolicyValidationResponse } from "@/lib/api"

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
        "CustomerRecord",
        "SupportTicket",
        "ResourceType",
        "Entity",
        "String",
        "Long",
        "Boolean",
        "Set",
        "Record",
        "ipaddr",
        "decimal",
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
        "/",
      ],
      tokenizer: {
        root: [
          [/\/\/.*$/, "comment"],
          [/"([^"\\]|\\.)*"/, "string"],
          [/\b[A-Z][a-zA-Z0-9_]*::/, "type.identifier"],
          [
            /\b[a-zA-Z_][a-zA-Z0-9_]*\b/,
            {
              cases: {
                "@keywords": "keyword",
                "@typeKeywords": "type",
                "@default": "identifier",
              },
            },
          ],
          [/[{}()\[\]]/, "delimiter"],
          [/[;,.]/, "delimiter"],
          [/==|!=|<=|>=|<|>|&&|\|\||!/, "operator"],
          [/\b\d+\b/, "number"],
        ],
      },
    })

    monaco.editor.defineTheme("policylab-cedar-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "F97316", fontStyle: "bold" },
        { token: "type", foreground: "38BDF8" },
        { token: "type.identifier", foreground: "C084FC" },
        { token: "string", foreground: "34D399" },
        { token: "comment", foreground: "6B7280", fontStyle: "italic" },
        { token: "operator", foreground: "F43F5E" },
        { token: "delimiter", foreground: "94A3B8" },
        { token: "number", foreground: "FBBF24" },
      ],
      colors: {
        "editor.background": "#0c1017",
        "editor.lineHighlightBackground": "#ffffff08",
        "editorCursor.foreground": "#F97316",
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
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [activeTab, setActiveTab] = useState<"code" | "schema">("code")
  const [code, setCode] = useState(
    selectedVersion === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT
  )
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<PolicyValidationResponse | null>(null)
  const [valDurationMs, setValDurationMs] = useState<number | null>(null)

  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const handleVersionChange = (ver: "v12" | "v13") => {
    setSelectedVersion(ver)
    const newCode = ver === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT
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
    navigator.clipboard.writeText(activeTab === "code" ? code : ACMEPAY_SCHEMA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

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
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate)
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

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground transition-all hover:scale-105"
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Inspect Diff</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Monaco Code Editor (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="glass-panel-premium rounded-2xl border border-white/[0.08] overflow-hidden">
            {/* Editor Sub-header / File tabs */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-black/40">
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

              <div className="flex items-center gap-2">
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

                {validationResult ? (
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

            {/* Code Body Area with Monaco */}
            <div className="bg-[#0c1017]">
              {activeTab === "code" ? (
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
                      setCode(value || "")
                      setIsSaved(false)
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
                    value={ACMEPAY_SCHEMA}
                    options={{
                      readOnly: true,
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
                {validationResult ? (
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
                ) : selectedVersion === "v13" ? (
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

              <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                {validationResult ? `Cedar WASM · ${valDurationMs ?? 0.8}ms` : "UTF-8 · LF · Cedar Core"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Context & Diagnostics (4 cols) */}
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
