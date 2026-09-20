/**
 * ConnectedWorkspaceSetup
 * 7-step guided import wizard for engineer-supplied Cedar authorization models.
 */
import React, { useState, useRef } from "react"
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, FileCode2,
  Hash, Database, ListChecks, GitCompare, Eye, X, Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Workspace, DEFAULT_CONNECTED_DATA, ConnectedWorkspaceData } from "@/store/workspaceStore"
import { Scenario } from "@/types/authz"

interface ConnectedWorkspaceSetupProps {
  onCancel: () => void
  onComplete: (ws: Workspace) => void
}

const STEPS = [
  { id: 1, label: "Name" },
  { id: 2, label: "Policy" },
  { id: 3, label: "Schema" },
  { id: 4, label: "Entities" },
  { id: 5, label: "Scenarios" },
  { id: 6, label: "Versions" },
  { id: 7, label: "Review" },
]

const MAX_FILE_SIZE = 500 * 1024

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File exceeds 500KB limit (${Math.round(file.size / 1024)}KB)`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

export const ConnectedWorkspaceSetup: React.FC<ConnectedWorkspaceSetupProps> = ({ onCancel, onComplete }) => {
  // useId omitted
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step data
  const [name, setName] = useState("")
  const [policyText, setPolicyText] = useState("")
  const [schemaText, setSchemaText] = useState("")
  const [entitiesJson, setEntitiesJson] = useState("")
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scPrincipal, setScPrincipal] = useState("")
  const [scAction, setScAction] = useState("")
  const [scResource, setScResource] = useState("")
  const [scExpected, setScExpected] = useState<"ALLOW" | "DENY">("DENY")
  const [scJsonPaste, setScJsonPaste] = useState("")
  const [baselineLabel, setBaselineLabel] = useState("Baseline")
  const [candidateLabel, setCandidateLabel] = useState("Candidate")
  const [candidatePolicyText, setCandidatePolicyText] = useState("")

  const policyFileRef = useRef<HTMLInputElement>(null)
  const schemaFileRef = useRef<HTMLInputElement>(null)
  const entitiesFileRef = useRef<HTMLInputElement>(null)
  const candidateFileRef = useRef<HTMLInputElement>(null)

  function validateStep(): boolean {
    const errs: Record<string, string> = {}
    if (step === 1 && !name.trim()) errs.name = "Workspace name is required."
    if (step === 2 && !policyText.trim()) errs.policy = "Policy text is required."
    if (step === 5 && scenarios.length === 0) errs.scenarios = "At least one scenario is required to run analysis."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => { if (!validateStep()) return; setErrors({}); setStep(s => s + 1) }
  const handleBack = () => { setErrors({}); setStep(s => s - 1) }

  async function handleFileUpload(
    ref: React.RefObject<HTMLInputElement | null>,
    setter: (t: string) => void,
    field: string,
    exts: string[]
  ) {
    const file = ref.current?.files?.[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!exts.includes(ext)) {
      setErrors(p => ({ ...p, [field]: `Unsupported file type .${ext}. Allowed: ${exts.join(", ")}` }))
      return
    }
    try {
      const t = await readFileText(file)
      setter(t)
      setErrors(p => ({ ...p, [field]: "" }))
    } catch (e: any) {
      setErrors(p => ({ ...p, [field]: e.message }))
    }
    if (ref.current) ref.current.value = ""
  }

  function handleAddScenario() {
    if (!scPrincipal.trim() || !scAction.trim() || !scResource.trim()) {
      setErrors(p => ({ ...p, scAdd: "Principal, Action, and Resource are required." }))
      return
    }
    const sc: Scenario = {
      id: `sc_${Date.now()}`,
      title: `${scPrincipal} ${scAction} ${scResource}`,
      principal: scPrincipal.trim(),
      action: scAction.trim(),
      resource: scResource.trim(),
      context: {},
      expectedDecision: scExpected,
      tags: [],
    }
    setScenarios(p => [...p, sc])
    setScPrincipal(""); setScAction(""); setScResource("")
    setErrors(p => ({ ...p, scAdd: "", scenarios: "" }))
  }

  function handlePasteScenarios() {
    try {
      const parsed = JSON.parse(scJsonPaste)
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of scenarios.")
      const mapped = parsed.map((s: any, i: number) => ({
        id: s.id || `sc_paste_${i}`,
        title: s.title || `Scenario ${i + 1}`,
        principal: s.principal || "",
        action: s.action || "",
        resource: s.resource || "",
        context: s.context || {},
        expectedDecision: (s.expectedDecision || "DENY") as "ALLOW" | "DENY",
        tags: s.tags || [],
      }))
      setScenarios(p => [...p, ...mapped])
      setScJsonPaste("")
      setErrors(p => ({ ...p, scPaste: "", scenarios: "" }))
    } catch (e: any) {
      setErrors(p => ({ ...p, scPaste: `Invalid JSON: ${e.message}` }))
    }
  }

  function handleFinish() {
    const connected: ConnectedWorkspaceData = {
      ...DEFAULT_CONNECTED_DATA,
      baselinePolicyText: policyText,
      baselineLabel,
      candidatePolicyText: candidatePolicyText || policyText,
      candidateLabel,
      schemaText,
      entitiesJson,
      scenarios,
      importSource: "MANUAL",
    }
    onComplete({
      id: `ws_${Date.now()}`,
      mode: "connected",
      name: name.trim(),
      createdAt: new Date().toISOString(),
      connected,
    })
  }

  const ic = "w-full bg-black/40 border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-orange-500/50 font-mono"
  const ta = "w-full bg-black/40 border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-orange-500/50 font-mono resize-none"

  const Err = ({ field }: { field: string }) =>
    errors[field] ? (
      <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {errors[field]}
      </p>
    ) : null

  return (
    <div className="min-h-screen bg-[#090A0D] flex items-start justify-center pt-12 px-4">
      <div className="fixed top-0 inset-x-0 h-[520px] cyber-aurora-top pointer-events-none z-0" />
      <div className="relative z-10 w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={onCancel} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">New Connected Workspace</h1>
            <p className="text-xs text-muted-foreground">
              Supply your own Cedar policies, schema, entities, and scenarios.
              <span className="font-mono ml-1 text-muted-foreground/60">Local session · No cloud charges</span>
            </p>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold shrink-0 flex items-center gap-1 ${
                step === s.id ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : step > s.id ? "bg-emerald-500/10 text-emerald-400"
                  : "text-muted-foreground/50"
              }`}>
                {step > s.id && <Check className="h-3 w-3" />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <div className="h-[1px] w-4 bg-white/[0.08] shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <Card className="glass-card-premium rounded-2xl border border-white/[0.08]">
          <CardContent className="p-6 space-y-5">

            {/* Step 1: Name */}
            {step === 1 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold">Workspace Name</CardTitle>
                  <p className="text-xs text-muted-foreground">Give this workspace a descriptive name identifying the project or authorization model.</p>
                </CardHeader>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Workspace Name *</label>
                  <input autoFocus className={ic} placeholder="e.g. MyApp Authorization Model" value={name} onChange={e => setName(e.target.value)} />
                  <Err field="name" />
                </div>
              </div>
            )}

            {/* Step 2: Policy */}
            {step === 2 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-orange-400" />Cedar Policy Text
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Paste your Cedar policy set or upload a .cedar file. This becomes the baseline. Max 500KB.</p>
                </CardHeader>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Policy Text (.cedar) *</label>
                    <label className="text-xs text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
                      Upload file
                      <input type="file" accept=".cedar,.txt" className="hidden" ref={policyFileRef}
                        onChange={() => handleFileUpload(policyFileRef, setPolicyText, "policy", ["cedar", "txt"])} />
                    </label>
                  </div>
                  <textarea rows={12} className={ta}
                    placeholder={"// Paste your Cedar policy here\npermit (\n    principal in Role::\"admin\",\n    action,\n    resource\n);"}
                    value={policyText} onChange={e => setPolicyText(e.target.value)} />
                  <Err field="policy" />
                  {policyText && <p className="text-[10px] text-emerald-400 mt-1 font-mono">{policyText.split("\n").length} lines loaded</p>}
                </div>
              </div>
            )}

            {/* Step 3: Schema */}
            {step === 3 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Hash className="h-4 w-4 text-sky-400" />Cedar Schema (Optional)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Paste your Cedar schema JSON or upload a .json file. Schema enables schema-aware validation. Analysis proceeds without it.</p>
                </CardHeader>
                {!schemaText && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-amber-300">No schema provided. Validation will check syntax only and cannot detect schema violations.</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Schema JSON (.json)</label>
                    <label className="text-xs text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
                      Upload file
                      <input type="file" accept=".json" className="hidden" ref={schemaFileRef}
                        onChange={() => handleFileUpload(schemaFileRef, setSchemaText, "schema", ["json"])} />
                    </label>
                  </div>
                  <textarea rows={10} className={ta} placeholder={'{\n  "MyNamespace": {\n    "entityTypes": {},\n    "actions": {}\n  }\n}'}
                    value={schemaText} onChange={e => setSchemaText(e.target.value)} />
                  <Err field="schema" />
                </div>
              </div>
            )}

            {/* Step 4: Entities */}
            {step === 4 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Database className="h-4 w-4 text-purple-400" />Entity Data (Optional)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Paste a JSON array of Cedar entities with uid, attrs, and parents fields. Required for attribute-based conditions and group memberships.</p>
                </CardHeader>
                <div className="p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/15 text-[11px] text-sky-300 space-y-1">
                  <p className="font-semibold">What you must supply separately:</p>
                  <p className="text-muted-foreground">A Cedar policy file alone does not contain entity data. Group memberships, resource attributes, and user attributes must be provided as a separate entity array. Without entities, attribute-based conditions evaluate against an empty entity store.</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Entity JSON Array (.json)</label>
                    <label className="text-xs text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
                      Upload file
                      <input type="file" accept=".json" className="hidden" ref={entitiesFileRef}
                        onChange={() => handleFileUpload(entitiesFileRef, setEntitiesJson, "entities", ["json"])} />
                    </label>
                  </div>
                  <textarea rows={8} className={ta} placeholder={'[\n  {\n    "uid": { "type": "User", "id": "alice" },\n    "attrs": {},\n    "parents": [{ "type": "Role", "id": "admin" }]\n  }\n]'}
                    value={entitiesJson} onChange={e => setEntitiesJson(e.target.value)} />
                  <Err field="entities" />
                </div>
              </div>
            )}

            {/* Step 5: Scenarios */}
            {step === 5 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-emerald-400" />Scenario Set *
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Define at least one authorization scenario. The declared scenario universe is the bounded scope of all analysis.</p>
                </CardHeader>
                <div className="p-3.5 rounded-xl bg-black/30 border border-white/[0.08] space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Add scenario manually</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Principal</label>
                      <input className={ic + " text-xs"} placeholder='User::"alice"' value={scPrincipal} onChange={e => setScPrincipal(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Action</label>
                      <input className={ic + " text-xs"} placeholder='Action::"view"' value={scAction} onChange={e => setScAction(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Resource</label>
                      <input className={ic + " text-xs"} placeholder='Doc::"doc1"' value={scResource} onChange={e => setScResource(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select className={ic + " w-36 text-xs"} value={scExpected} onChange={e => setScExpected(e.target.value as "ALLOW"|"DENY")}>
                      <option value="ALLOW">Expected: ALLOW</option>
                      <option value="DENY">Expected: DENY</option>
                    </select>
                    <Button size="sm" onClick={handleAddScenario} className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
                      <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                  </div>
                  <Err field="scAdd" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Or paste scenario JSON array</p>
                  <textarea rows={3} className={ta} placeholder='[{ "principal": "User::\"alice\"", "action": "Action::\"view\"", "resource": "Doc::\"d1\"", "expectedDecision": "ALLOW" }]'
                    value={scJsonPaste} onChange={e => setScJsonPaste(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handlePasteScenarios} disabled={!scJsonPaste.trim()} className="h-7 text-xs border-white/[0.12]">Import JSON</Button>
                    <Err field="scPaste" />
                  </div>
                </div>
                {scenarios.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-mono">
                      Declared Universe ({scenarios.length} scenario{scenarios.length !== 1 ? "s" : ""})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {scenarios.map((sc, i) => (
                        <div key={sc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/[0.06] text-xs">
                          <span className="font-mono text-muted-foreground text-[10px]">{i+1}.</span>
                          <span className="font-mono text-foreground/80 truncate flex-1">{sc.principal} → {sc.action} → {sc.resource}</span>
                          <Badge variant={sc.expectedDecision === "ALLOW" ? "allow" : "deny"} className="text-[9px] shrink-0">{sc.expectedDecision}</Badge>
                          <button onClick={() => setScenarios(p => p.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-red-400 shrink-0"><X className="h-3 w-3"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Err field="scenarios" />
              </div>
            )}

            {/* Step 6: Versions */}
            {step === 6 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-amber-400" />Baseline & Candidate Versions
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Label the baseline (production) and candidate (proposed change) versions. Upload a separate candidate if available.</p>
                </CardHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Baseline Label</label>
                    <input className={ic} placeholder="e.g. v1 (Production)" value={baselineLabel} onChange={e => setBaselineLabel(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Candidate Label</label>
                    <input className={ic} placeholder="e.g. v2 (Candidate)" value={candidateLabel} onChange={e => setCandidateLabel(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Candidate Policy Text (.cedar) — optional</label>
                    <label className="text-xs text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
                      Upload file
                      <input type="file" accept=".cedar,.txt" className="hidden" ref={candidateFileRef}
                        onChange={() => handleFileUpload(candidateFileRef, setCandidatePolicyText, "candidate", ["cedar", "txt"])} />
                    </label>
                  </div>
                  <textarea rows={8} className={ta}
                    placeholder="Paste candidate policy here, or leave blank to use baseline policy as both versions."
                    value={candidatePolicyText} onChange={e => setCandidatePolicyText(e.target.value)} />
                  {!candidatePolicyText && (
                    <p className="text-[10px] text-amber-400 mt-1 font-mono">No candidate supplied — baseline will be used as both. You can edit candidate in the Policy Editor.</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 7: Review */}
            {step === 7 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-sky-400" />Review & Create
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Review your workspace configuration. Analysis is scoped to the declared scenario universe.</p>
                </CardHeader>
                <div className="space-y-2">
                  {[
                    { label: "Workspace Name", value: name, ok: true },
                    { label: "Baseline Label", value: baselineLabel, ok: true },
                    { label: "Candidate Label", value: candidateLabel, ok: true },
                    { label: "Policy Text", value: `${policyText.split("\n").length} lines`, ok: !!policyText },
                    { label: "Candidate Policy", value: candidatePolicyText ? `${candidatePolicyText.split("\n").length} lines` : "Same as baseline", ok: true },
                    { label: "Schema", value: schemaText ? "Provided" : "Not provided (syntax-only validation)", ok: true, warn: !schemaText },
                    { label: "Entities", value: entitiesJson ? "Provided" : "Not provided (empty entity store)", ok: true, warn: !entitiesJson },
                    { label: "Scenarios", value: `${scenarios.length} declared`, ok: scenarios.length > 0 },
                    { label: "Persistence Scope", value: "Local session (localStorage)", ok: true },
                    { label: "Evaluation Engine", value: "Local Cedar WASM 4.13.0", ok: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.05]">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-mono text-[11px] flex items-center gap-1 ${(row as any).warn ? "text-amber-400" : row.ok ? "text-foreground" : "text-red-400"}`}>
                        {(!row.ok || (row as any).warn) && <AlertTriangle className="h-3 w-3" />}
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                {scenarios.length === 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-red-300">No scenarios defined. Go back to Step 5 to add at least one scenario. Analysis cannot run without a declared scenario universe.</span>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between pb-8">
          <Button variant="ghost" size="sm" onClick={step === 1 ? onCancel : handleBack} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 7 ? (
            <Button size="sm" onClick={handleNext} className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-1.5">
              Next<ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleFinish} disabled={scenarios.length === 0} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
              <Check className="h-3.5 w-3.5" />Create Workspace
            </Button>
          )}
        </div>

      </div>
    </div>
  )
}
