import React from "react"
import { Code2, GitCommit, FileCode } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface PolicyDiffPanelProps {
  candidateVersion: "v13" | "v13_fixed"
}

export const PolicyDiffPanel: React.FC<PolicyDiffPanelProps> = ({ candidateVersion }) => {
  const isV13Draft = candidateVersion === "v13"

  return (
    <Card className="glass-panel-premium border-white/[0.08] shadow-2xl flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 border-b border-white/[0.08] bg-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_#F97316]" />
            <div>
              <CardTitle className="text-xs font-bold text-foreground font-mono flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-orange-400" />
                Policy Diff (v12 ➔ {isV13Draft ? "v13" : "v13-fixed"})
              </CardTitle>
              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                <FileCode className="h-3 w-3 text-muted-foreground/60" />
                <span>services/payment/policy.cedar</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground border border-white/[0.08]">
              v12 (Baseline)
            </span>
            <span className="text-muted-foreground/40">➔</span>
            <span
              className={`px-1.5 py-0.5 rounded border font-semibold ${
                isV13Draft
                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {isV13Draft ? "v13 (Draft)" : "v13 (Fixed)"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col justify-between font-mono text-[11px] overflow-hidden">
        {/* Code Diff Line Listing */}
        <div className="divide-y divide-white/[0.03] overflow-y-auto max-h-[460px] p-2 space-y-0.5">
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">128</span>
            <span className="text-muted-foreground">permit (</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">130</span>
            <span className="text-muted-foreground pl-3">principal == User::"*",</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">133</span>
            <span className="text-muted-foreground pl-3">action == Action::"viewAccount",</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">134</span>
            <span className="text-muted-foreground pl-3">resource in Account::"*"</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">135</span>
            <span className="text-muted-foreground">)</span>
          </div>

          {/* Deleted Line in Red */}
          <div className="flex items-center bg-red-500/15 text-red-300 px-2 py-1 rounded border border-red-500/20 my-1">
            <span className="w-8 shrink-0 select-none text-red-400 font-bold">136</span>
            <span className="font-semibold">- && resource.account_type == "internal"</span>
          </div>

          {/* Added Line in Green or Fixed */}
          {isV13Draft ? (
            <div className="flex items-center bg-red-500/15 text-red-300 px-2 py-1 rounded border border-red-500/20 my-1">
              <span className="w-8 shrink-0 select-none text-red-400 font-bold">136</span>
              <span className="font-semibold">+ && resource.account_type in ["internal", "partner"]</span>
            </div>
          ) : (
            <div className="flex items-center bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded border border-emerald-500/20 my-1">
              <span className="w-8 shrink-0 select-none text-emerald-400 font-bold">136</span>
              <span className="font-semibold">+ && resource.account_type == "internal" // Restored</span>
            </div>
          )}

          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px] mt-1">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">138</span>
            <span className="text-muted-foreground">permit (</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">139</span>
            <span className="text-muted-foreground pl-3">principal in Group::"Admins",</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">140</span>
            <span className="text-muted-foreground pl-3">action == Action::"deleteAccount",</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">141</span>
            <span className="text-muted-foreground pl-3">resource in Account</span>
          </div>
          <div className="flex items-center text-muted-foreground/60 px-2 py-0.5 text-[10px]">
            <span className="w-8 shrink-0 select-none text-muted-foreground/40">142</span>
            <span className="text-muted-foreground">);</span>
          </div>
        </div>

        {/* Bottom Change Stats Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5 text-orange-400" />
            <span>3 lines changed</span>
          </div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-emerald-400">+ 2 additions</span>
            <span className="text-red-400">- 1 deletion</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
