# AgentOS Orchestrator Engine Structure & Architecture Guide

Date: 2026-06-26

This document provides a detailed breakdown of the `agent-infra` codebase structure, component responsibilities, concurrency patterns, and data flows.

---

## 1. Codebase Overview

AgentOS is organized as a single Go module (`anishs1207/ai-infra`) with a top-level orchestrator entrypoint and a core logic package `orchestrator`:

```
apps/agent-infra/
├── main.go               # Orchestrator startup, subsystem bootstrap, HTTP server
├── ARCHITECTURE.md       # High-level architecture summary & subsystem graph
├── README.md             # Developer setup, quick start, configuration format
├── STRUCTURE.md          # This file (detailed file and data flow guide)
└── orchestrator/         # Core library package files
    ├── manifest.go       # YAML parsing, validation, agent manifests
    ├── process.go        # Subprocess spawns, port allocations, health probes
    ├── scheduler.go      # Replica reconciliation, scaling, autoscaling
    ├── proxy.go          # Reverse-proxy gateway, canary weight router
    ├── server.go         # REST API handlers, control plane routing
    ├── queue.go          # Concurrent worker queues, async tasks
    ├── workflow.go       # Pipeline execution, output interpolations
    ├── eventbus.go       # Pub/Sub event router, subscriber webhooks
    ├── node.go           # Virtual node clusters, resources & scheduling
    ├── secret.go         # Namespaced credential store
    ├── state.go          # postgres & redis detection, in-memory backup
    ├── registry.go       # Agent manifest repository
    └── observability.go  # Metric counters, cost logs, prometheus exporter
```

---

## 2. Subsystem File-by-File Details

### `main.go`
- **Purpose**: Server lifecycle manager.
- **Key Operations**:
  - Traps OS interrupt signals (`SIGINT`, `SIGTERM`) using `signal.NotifyContext`.
  - Instantiates shared managers (Port Pool, Node Fleet, Secrets, State Store, Metrics Tracker).
  - Spawns background reconciliation, metrics-based autoscaling, and job queue workers.
  - Binds HTTP Server to port `8080` with preflight CORS headers support.
  - Coordinates graceful cleanup: shuts down the server API gateway first, then terminates all backing agent replica subprocesses.

### `orchestrator/manifest.go`
- **Purpose**: Defines agent specification schema.
- **Key Structs**:
  - `AgentManifest`: Config spec loaded from `agent.yaml` containing program executable `command`, `replicas` configuration boundaries, dynamic `env` lists, `placement` constraints, and optional `autoscaling` limits.

### `orchestrator/process.go`
- **Purpose**: Subprocess runtime wrapper & Port allocator.
- **Key Structs**:
  - `AgentInstance`: Represents a single running replica of an agent. Keeps process execution details (`exec.Cmd`), console stdout/stderr buffers, status (`SPAWNING`, `HEALTHY`, `UNHEALTHY`, `TERMINATED`), and target node.
  - `PortAllocator`: Manages an allocated port pool.
- **Key Logic**:
  - `Start()`: Determines OS shell command launcher (`cmd /C` on Windows, `/bin/sh -c` on Unix), merges global/namespaced secrets into environment variables, pipes logs, and fires background routines for log streaming and HTTP `/health` readiness probes.
  - `Stop()`: Kills processes. On Windows, it invokes `taskkill /F /T` to clean up child process trees (node, python, etc.) to prevent orphaned processes.

### `orchestrator/scheduler.go`
- **Purpose**: Deployment coordinator.
- **Key Structs**:
  - `AgentDeployment`: Wraps the agent's spec, current instances list, terminated replica history window (last 5 runs), and last traffic activity timestamp.
  - `Scheduler`: Maps deployments, manages reconciliations, and runs background scaling loops.
- **Key Logic**:
  - `Reconcile()`: Compares actual replica states to desired scale numbers. Scale-up requests reserve ports, select nodes, allocate resources, and spawn processes. Scale-down requests stop target instances.
  - `EnsureActive()`: Blocks requests targeting scaled-to-zero (0 replicas) agents. Automatically scales the deployment to 1, schedules the replica, blocks until the health probe passes, and then routes traffic.
  - `StartScaleToZeroMonitor()` / `StartMetricsAutoscaler()`: Periodically checks deployment metrics (queue depth, cpu, memory, rps, tokens) and automatically rescales agent pools.

### `orchestrator/proxy.go`
- **Purpose**: Gateway proxy router.
- **Key Structs**:
  - `ProxyHandler`: Routes incoming `/proxy/:agent_name/*` to backend replica instances.
- **Key Logic**:
  - Parses headers for tenant validation.
  - Automatically wakes up scaled-to-zero replicas using `Scheduler.EnsureActive()`.
  - Dispatches requests using a round-robin selector over healthy backing processes.
  - Handles canary rules by rolling dice percentages to target canary versions.

### `orchestrator/queue.go`
- **Purpose**: Asynchronous task executor.
- **Key Structs**:
  - `Job`: Holds input payloads, execution status, finished times, and result responses.
  - `JobQueue`: Maps task history logs and manages task queue channels.
- **Key Logic**:
  - Spawns worker threads (`workerLoop`) listening on buffered channels.
  - Ensures backing agents are scaled up, selects replicas, sends HTTP POST to `/invoke` (or falls back to GET query parameters), parses JSON responses, and registers results.

### `orchestrator/workflow.go`
- **Purpose**: Multi-agent pipelines step coordinator.
- **Key Structs**:
  - `WorkflowDefinition` / `WorkflowExecution`: Pipeline blueprint structures and runtime data tracking context maps.
- **Key Logic**:
  - Evaluates step-by-step pipeline runs in background routines.
  - Interpolates dynamic template inputs using outputs from previous steps:
    - `{{input.key}}` -> Global execution parameter input.
    - `{{steps.stepname.output.field}}` -> Resolved field from a prior step's JSON response output.
  - Sequentially submits async jobs to the `JobQueue`, polling results before running next steps.

### `orchestrator/eventbus.go`
- **Purpose**: Event router and notification forwarder.
- **Key Logic**:
  - Manages subscription topic maps.
  - Broadcasts payloads asynchronously via HTTP POST webhooks to subscriber agents.

### `orchestrator/node.go`
- **Purpose**: Simulates the host compute cluster hardware.
- **Key Logic**:
  - Evaluates region requirements, GPU flags, memory sizes, and least CPU load metrics to route agent workloads to the best candidate node.
  - Supports node status updates (e.g. `DRAINING`), triggering automatic agent evictions and rescheduling.

---

## 3. Concurrency & Synchronization Model

AgentOS handles multiple concurrent control plane actions, API queries, and proxy requests safely using these conventions:

- **Granular Lock Scoping**: Deployments, Instances, Nodes, Job Queue, and Metrics hold independent read-write locks (`sync.RWMutex`). This prevents global API lockups during intensive tasks.
- **Thread-Safe Map Access**: All map registries (e.g., deployments, jobs, workflows) are protected by locks.
- **Safe Copy-on-Query**: Deep copies of task logs or deployment details are created under read locks before serialization to prevent racing conditions between background tasks and REST API endpoint queries.
- **OS Subprocess Safety**: The port manager validates port statuses at the OS layer, and process termination routines cleanly clean up child processes to prevent platform-dependent memory leaks.

---

## 4. Key Data Flows

### A. HTTP Proxy Route Gateway Flow
```
Client Request -> /proxy/weather-agent/forecast
                     |
            [Header Tenant Check]
                     |
          [Check desired replicas]
          - If 0 replicas: scale-to-1 & block until /health probe returns OK
          - If > 0: fetch active replicas
                     |
       [Apply Canary Dice Roll Weights] -> Selects Version
                     |
       [Round Robin Select Healthy Inst] -> Target Replica Port (e.g. 10002)
                     |
          [Forward request payload] -> Client Response
```

### B. Asynchronous Job Processing Flow
```
POST /api/agents/weather-agent/jobs
                     |
         [Job registered in queue]
         [Return Job ID immediately]
                     |
     Job ID enqueued to queueChannel <--- Queue Workers poll channel
                                                |
                                   [Ensure Target Agent Active]
                                                |
                                    [Select Healthy Instance]
                                                |
                                    [HTTP POST /invoke endpoint]
                                   - Failover: HTTP GET parameters
                                                |
                                      [Update Job Response]
```
