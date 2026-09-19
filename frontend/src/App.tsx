import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Layers,
  FileCode2,
  Lock,
  ArrowRight,
} from "lucide-react"

export function App() {
  const [activeEnv, setActiveEnv] = useState("staging")

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-[#0E131F]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black tracking-wider text-white shadow-lg shadow-indigo-500/20">
              PL
            </div>
            <div>
              <span className="font-bold tracking-tight text-white">PolicyLab</span>
              <span className="text-xs text-slate-400 ml-2 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                shadcn/ui Ready
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-slate-400 border-slate-700">
              AcmePay-Core-Authz
            </Badge>
            <Badge variant="allow">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Engine: Cedar v3
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Prove your authorization changes before production.
          </h1>
          <p className="text-slate-400 text-base max-w-3xl">
            shadcn/ui, Tailwind CSS design tokens, and path aliases are successfully configured for PolicyLab.
          </p>
        </div>

        <Separator className="bg-slate-800" />

        {/* Feature Grid with shadcn Cards & Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-800 bg-[#0E131F] hover:border-slate-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Deterministic Engine
                </CardTitle>
                <Badge variant="allow">Ready</Badge>
              </div>
              <CardDescription>Cedar AST & scenario simulator</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Evaluates authorization requests and computes blast radius deltas in sub-second execution times.
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full text-xs">
                Inspect Simulator
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-slate-800 bg-[#0E131F] hover:border-slate-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  Hero Blast Radius
                </CardTitle>
                <Badge variant="destructive">P0 Active</Badge>
              </div>
              <CardDescription>Behavioral matrix diff & counterexamples</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Detects unintended permission expansion (+3 actions, +184 resources) before code reaches production.
            </CardContent>
            <CardFooter>
              <Button variant="deny" size="sm" className="w-full text-xs">
                View Counterexamples
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-slate-800 bg-[#0E131F] hover:border-slate-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-400" />
                  Amazon Bedrock & Strands
                </CardTitle>
                <Badge variant="ai">Grounded</Badge>
              </div>
              <CardDescription>AI reasoning around verified facts</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Explains deterministic counterexamples and suggests precise Cedar code remediations.
            </CardContent>
            <CardFooter>
              <Button variant="ai" size="sm" className="w-full text-xs">
                Audit Evidence
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Interactive Tabs Demonstration */}
        <Card className="border-slate-800 bg-[#0E131F]">
          <Tabs value={activeEnv} onValueChange={setActiveEnv}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-indigo-400" />
                    Pre-Deployment Gate Verification
                  </CardTitle>
                  <CardDescription>
                    Enforcing deterministic security contracts before synchronization to Amazon Verified Permissions
                  </CardDescription>
                </div>

                <TabsList className="bg-slate-900 border-slate-800">
                  <TabsTrigger value="staging">Staging</TabsTrigger>
                  <TabsTrigger value="production">Production</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <TabsContent value="staging" className="m-0">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Cedar Validation</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">✓ Valid Schema</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Regression Suite</span>
                    <p className="text-sm font-bold text-slate-200 mt-1">18 / 18 Passed</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Security Invariants</span>
                    <p className="text-sm font-bold text-slate-200 mt-1">6 / 6 Satisfied</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Gate Status</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">🟢 Verified & Ready</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="production" className="m-0">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Active Policy Version</span>
                    <p className="text-sm font-bold text-slate-200 mt-1">v12 (Production)</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Integrity Hash</span>
                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">8a3e77f...91bc</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">AVP Status</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">🟢 Synchronized</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Deployment Gate</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">✓ Active Gate</p>
                  </div>
                </div>
              </TabsContent>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-slate-800/80 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileCode2 className="h-4 w-4 text-slate-500" />
                <span>Target Store: <code className="text-slate-300">ps-acmepay-{activeEnv}</code></span>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-2 shadow-lg shadow-emerald-900/20">
                Deploy to Verified Permissions
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Tabs>
        </Card>
      </main>
    </div>
  )
}

export default App
