"use client"

import { useEffect, useState } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"

type Persona = {
    id: number
    name: string
    background: string
    ideology: string
    speech: string
    capital?: number
    portfolioValue?: number
}

type Phase =
    | "setup"
    | "campaign"
    | "voting"
    | "council"
    | "leader"
    | "scenario"
    | "decision"
    | "debate"
    | "stocks"

const MAX_PERSONAS = 50

export default function Page() {
    const [phase, setPhase] = useState<Phase>("setup")
    const [numPersonas, setNumPersonas] = useState(15)
    const [personas, setPersonas] = useState<Persona[]>([])
    const [topFive, setTopFive] = useState<Persona[]>([])
    const [leader, setLeader] = useState<Persona | null>(null)
    const [scenario, setScenario] = useState("")
    const [decision, setDecision] = useState("")
    const [approval, setApproval] = useState<number | null>(null)
    const [history, setHistory] = useState<
        { leader: string; decision: string; approval: number }[]
    >([])
    const [debateTopic, setDebateTopic] = useState("Should AI regulation be stricter?")
    const [debateArgs, setDebateArgs] = useState<{ pro: string[]; con: string[] }>({ pro: [], con: [] })
    const [stockSim, setStockSim] = useState<Persona[]>([])

    useEffect(() => {
        if (phase === "campaign") generatePersonas()
        if (phase === "stocks") generateStockSim()
    }, [phase])

    function generatePersonas() {
        const p: Persona[] = Array.from({ length: numPersonas }).map((_, i) => ({
            id: i,
            name: `Agent ${i + 1}`,
            background: ["Economist", "Engineer", "Philosopher", "Investor", "Policy Expert"][i % 5],
            ideology: ["Risk-first", "Conservative", "Utilitarian", "Ethical", "Visionary"][i % 5],
            speech: `I bring a ${["data-driven", "human-centered", "growth-first", "ethical", "long-term"][i % 5]} approach to decision-making and governance.`,
        }))
        setPersonas(p)
        setTopFive([])
        setLeader(null)
        setScenario("")
        setDecision("")
        setApproval(null)
        setHistory([])
        setDebateArgs({ pro: [], con: [] })
    }

    function conductVoting() {
        const scores: Record<number, number> = {}
        personas.forEach(() => {
            shuffle(personas.map((p) => p.id))
                .slice(0, 3)
                .forEach((id, idx) => {
                    scores[id] = (scores[id] || 0) + (3 - idx)
                })
        })
        setTopFive(
            [...personas].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).slice(0, 5)
        )
        setPhase("council")
    }

    function chooseLeader() {
        const chosen = topFive[Math.floor(Math.random() * topFive.length)]
        setLeader(chosen)
        setPhase("leader")
    }

    function generateScenario() {
        setScenario("Global markets are volatile, AI regulation is tightening.")
        setPhase("scenario")
    }

    function makeDecision() {
        const dec = "Preserve cash, invest selectively in AI infrastructure."
        const appr = Math.floor(Math.random() * 100)
        setDecision(dec)
        setApproval(appr)
        setPhase("decision")
        setHistory((prev) => [...prev, { leader: leader!.name, decision: dec, approval: appr }])
    }

    function startDebate() {
        const pros = personas.slice(0, Math.ceil(personas.length / 2)).map(p => `${p.name} argues PRO: AI regulation helps society.`)
        const cons = personas.slice(Math.ceil(personas.length / 2)).map(p => `${p.name} argues CON: AI regulation stifles innovation.`)
        setDebateArgs({ pro: pros, con: cons })
        setPhase("debate")
    }

    function generateStockSim() {
        const sim = personas.map(p => ({ ...p, capital: 100000, portfolioValue: 100000 }))
        setStockSim(sim)
    }

    function runStockRound() {
        setStockSim(prev => prev.map(p => {
            const change = Math.random() * 0.2 - 0.1 // -10% to +10%
            const newValue = Math.max(0, (p.portfolioValue || 100000) * (1 + change))
            return { ...p, portfolioValue: newValue }
        }))
    }

    function reset() {
        setPhase("setup")
        setPersonas([])
        setTopFive([])
        setLeader(null)
        setScenario("")
        setDecision("")
        setApproval(null)
        setHistory([])
        setDebateArgs({ pro: [], con: [] })
        setStockSim([])
    }

    function shuffle(arr: number[]) {
        return [...arr].sort(() => Math.random() - 0.5)
    }

    const overthrown = approval !== null && approval < 50

    return (
        <main className="max-w-7xl mx-auto p-8 space-y-6">
            <header className="space-y-1">
                <h1 className="text-3xl font-bold">LLM Multi-Agent Simulation</h1>
                <p className="text-muted-foreground">
                    Campaign → Vote → Council → Leader → Scenario → Decision → Debate → Stocks
                </p>
            </header>

            <Separator />

            {phase === "setup" && (
                <Card className="space-y-4 p-4">
                    <CardTitle>Setup Personas</CardTitle>
                    <p>Choose how many agents to deploy (max {MAX_PERSONAS})</p>
                    <Input
                        type="number"
                        min={1}
                        max={MAX_PERSONAS}
                        value={numPersonas}
                        onChange={(e) => setNumPersonas(Math.min(MAX_PERSONAS, Math.max(1, Number(e.target.value))))}
                    />
                    <Button onClick={() => setPhase("campaign")}>Deploy Agents</Button>
                </Card>
            )}

            {(phase !== "setup") && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT PANEL: Personas */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="font-semibold">
                            {phase === "council" || phase === "leader" ? "Elected Council" : "Campaigning Agents"}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(phase === "council" || phase === "leader" ? topFive : personas).map((p) => (
                                <Card key={p.id} className={leader?.id === p.id ? "border-primary" : ""}>
                                    <CardHeader>
                                        <CardTitle className="text-sm">{p.name}</CardTitle>
                                        <div className="flex gap-1 flex-wrap">
                                            <Badge variant="outline">{p.background}</Badge>
                                            <Badge>{p.ideology}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-xs text-muted-foreground">{p.speech}</CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Phase Buttons */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {phase === "campaign" && <Button onClick={() => { setPhase("voting"); conductVoting() }}>Run Vote</Button>}
                            {phase === "council" && <Button variant="secondary" onClick={chooseLeader}>Council Selects Leader</Button>}
                            {phase === "leader" && <Button onClick={generateScenario}>Generate Scenario</Button>}
                            {phase === "scenario" && <Button variant="secondary" onClick={makeDecision}>Make Decision</Button>}
                            {phase === "decision" && <Button variant="destructive" onClick={startDebate}>Start Debate</Button>}
                            {phase === "debate" && <Button variant="secondary" onClick={() => setPhase("stocks")}>Start Stock Simulation</Button>}
                            {phase === "stocks" && <Button onClick={runStockRound}>Run Stock Round</Button>}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Decision / Debate / Stocks */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Panel Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {phase === "leader" && leader && <p><strong>Leader:</strong> {leader.name}</p>}
                                {scenario && <p><strong>Scenario:</strong> {scenario}</p>}
                                {decision && <p><strong>Decision:</strong> {decision}</p>}
                                {approval !== null && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Public Approval</span>
                                            <span>{approval}%</span>
                                        </div>
                                        <Progress value={approval} />
                                    </>
                                )}
                                {overthrown && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Leader Overthrown</AlertTitle>
                                        <AlertDescription>Majority disapproved. Re-election triggered.</AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>

                        {phase === "debate" && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Debate on: {debateTopic}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs space-y-2">
                                    <strong>Pro:</strong>
                                    {debateArgs.pro.map((p, i) => <div key={i}>{p}</div>)}
                                    <strong>Con:</strong>
                                    {debateArgs.con.map((c, i) => <div key={i}>{c}</div>)}
                                </CardContent>
                            </Card>
                        )}

                        {phase === "stocks" && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Stock Simulation (Start $100k each)</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1">
                                    {stockSim.map(p => (
                                        <div key={p.id}>
                                            <strong>{p.name}</strong>: ${p.portfolioValue?.toFixed(0)}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {history.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>History Log</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1">
                                    {history.map((h, idx) => (
                                        <div key={idx}>
                                            <strong>{h.leader}</strong> → {h.decision} <Badge>{h.approval}%</Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        <Button variant="outline" onClick={reset}>Reset Simulation</Button>
                    </div>
                </div>
            )}
        </main>
    )
}
