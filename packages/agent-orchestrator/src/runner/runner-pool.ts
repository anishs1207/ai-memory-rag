import { exec } from "node:child_process"
import { promisify } from "node:util"
import type { Pod, PoolStatus } from "../types/workflow.js"

const execAsync = promisify(exec)
const DEFAULT_LOCAL_CONCURRENCY = 4
const DEFAULT_LOCAL_TIMEOUT_MS = 120_000

export type RunnerMode = "local" | "kubernetes"

export interface RunnerPool {
  readonly mode: RunnerMode
  acquirePod(): Promise<Pod>
  releasePod(podId: string): Promise<void>
  execInPod(podId: string, command: string): Promise<string>
  getPoolStatus(): PoolStatus
}

class LocalRunnerPool implements RunnerPool {
  readonly mode = "local" as const
  private readonly leases = new Map<string, boolean>()

  constructor() {
    const configured = Number(process.env.LOCAL_RUNNER_CONCURRENCY)
    const concurrency = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_LOCAL_CONCURRENCY
    for (let index = 1; index <= concurrency; index += 1) this.leases.set(`local-${index}`, false)
  }

  async acquirePod(): Promise<Pod> {
    for (const [podId, leased] of this.leases) {
      if (leased) continue
      this.leases.set(podId, true)
      return { podId, podName: podId, namespace: "local" }
    }
    throw new Error("NO_POD_AVAILABLE")
  }

  async releasePod(podId: string): Promise<void> {
    if (!this.leases.has(podId)) throw new Error(`Unknown local runner id: ${podId}`)
    this.leases.set(podId, false)
  }

  async execInPod(podId: string, command: string): Promise<string> {
    if (!this.leases.get(podId)) throw new Error(`Local runner ${podId} is not leased`)
    const configured = Number(process.env.LOCAL_RUNNER_TIMEOUT_MS)
    const timeout = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LOCAL_TIMEOUT_MS
    const { stdout } = await execAsync(command, {
      cwd: process.env.LOCAL_RUNNER_CWD || process.cwd(),
      timeout,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout
  }

  getPoolStatus(): PoolStatus {
    const leased = [...this.leases.entries()].filter(([, value]) => value).map(([podId]) => podId)
    return { total: this.leases.size, available: this.leases.size - leased.length, leased }
  }
}

class LazyKubernetesRunnerPool implements RunnerPool {
  readonly mode = "kubernetes" as const
  private poolPromise: Promise<RunnerPool> | undefined

  private getPool(): Promise<RunnerPool> {
    if (!this.poolPromise) {
      this.poolPromise = import("../k8s/pod-pool.js").then(({ PodPool }) => new PodPool())
    }
    return this.poolPromise
  }

  async acquirePod(): Promise<Pod> { return (await this.getPool()).acquirePod() }
  async releasePod(podId: string): Promise<void> { return (await this.getPool()).releasePod(podId) }
  async execInPod(podId: string, command: string): Promise<string> { return (await this.getPool()).execInPod(podId, command) }
  getPoolStatus(): PoolStatus { return { total: 0, available: 0, leased: [] } }
}

function getRunnerMode(): RunnerMode {
  const configured = process.env.EXECUTION_BACKEND?.trim().toLowerCase()
  if (!configured || configured === "local") return "local"
  if (configured === "kubernetes" || configured === "k8s") return "kubernetes"
  throw new Error(`Unsupported EXECUTION_BACKEND: ${configured}`)
}

export const runnerPool: RunnerPool = getRunnerMode() === "kubernetes"
  ? new LazyKubernetesRunnerPool()
  : new LocalRunnerPool()
