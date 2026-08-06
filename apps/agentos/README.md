# AgentOS Orchestrator Engine

AgentOS is a production-grade, lightweight, Kubernetes-like orchestrator for AI agents written in Go. It manages agent lifecycles, handles dynamic host port allocation, reverse-proxies and load-balances incoming traffic, implements scale-to-zero autoscaling, tracks costs, manages node fleets, coordinates multi-agent workflow pipelines, and processes long-running agent tasks via an internal background job queue.

It is designed to support agents built in any language or framework (e.g., LangChain, CrewAI, LangGraph, Zod-agents) by running them as sandboxed service microservices that communicate over HTTP.

---

## System Architecture Diagram

```
                                 +---------------------------------------------+
                                 |          Developer Control Panel            |
                                 |        (Served static at /dashboard/)       |
                                 +----------------------+----------------------+
                                                        | (REST APIs & Proxy Calls)
                                                        v
                                 +---------------------------------------------+
                                 |            Control Plane Gateway            |
                                 |                 (Port 8080)                 |
                                 +---+------------------+------------------+---+
                                     |                  |                  |
                       [HTTP Proxy]  |    [Control API] |       [Job API]  |
                                     v                  v                  v
                                 +---+----+      +------+-----+      +-----+----+
                                 | Reverse|      |  Registry  |      |   Job    |
                                 | Proxy  |      |     &      |      |  Queue   |
                                 | Loader |      | Marketplace|      |  Workers |
                                 +---+----+      +------+-----+      +-----+----+
                                     |                  |                  |
                                     | (routes)         | (config spec)    | (submits jobs)
                                     v                  v                  v
                                 +---+------------------+------------------+---+
                                 |                 Scheduler                   |
                                 |   (Autoscale / Port Pool / Placement)       |
                                 +---+-----+------------+-----+------------+-----+
                                     |     |            |     |            |
                                     |     | [Secrets]  |     | [State]    | [Metrics]
                                     v     v            v     v            v
                                 +---+-----+------------+-----+------------+-----+
                                 |  Secrets  |  Event Bus | State Store| Observ-|
                                 |  Manager  |  (Pub/Sub) | (Cache/DB) | ability|
                                 +-----------+------------+------------+--------+
                                                        |
                                                        | (coordinates steps)
                                                        v
                                 +---------------------------------------------+
                                 |               Workflow Engine               |
                                 |         (Pipeline Steps Executor)           |
                                 +----------------------+----------------------+
                                                        |
                                                        | (schedules onto)
                                                        v
                                 +---------------------------------------------+
                                 |              Cluster Node Fleet             |
                                 |      [node-a]     [node-b]     [node-c]     |
                                 |     (GPU, 32G)   (GPU, 32G)   (CPU, 16G)    |
                                 +----------------------+----------------------+
                                                        |
                                                        | (hosts replicas)
                                                        v
                                 +---------------------------------------------+
                                 |             Agent Worker Fleet              |
                                 |   (weather-agent, calculator-agent, etc.)   |
                                 +---------------------------------------------+
```

---

## Detailed Subsystem Functionality

### 1. Gateway & Reverse Proxy Router
* **Path Routing**: Listens at port `8080`. API commands are processed under `/api/*`, static dashboard panels at `/dashboard/`, and agent microservice traffic under `/proxy/:agent_name/*`.
* **Load Balancing**: Distributes incoming requests in a round-robin format across all healthy running replica containers of the requested agent.
* **On-Demand Scaling**: If a request hits a scaled-to-zero agent, the proxy blocks the request, instructs the scheduler to spawn a replica container, waits until the replica passes the `/health` readiness check, and then forwards the request transparently.

### 2. Scheduler & Resource Placement
* **Reconciler Loop**: Regularly compares the current running instances against desired specifications. It automatically scales up (spawning subprocesses and mapping ports) or down (gracefully terminating subprocesses) as required.
* **Dynamic Port Allocation**: Reserves and manages a host port pool (`10000-11000`). It dynamically assigns ports to running replicas and injects the port value via the `PORT` environment variable.
* **Node Scheduling**: When scaling up, the scheduler delegates node selection to the **Node Manager**. Replicas are scheduled onto nodes (`node-a`, `node-b`, `node-c`) based on:
  - **Region Constraints**: Matching the agent's desired deployment region.
  - **Hardware Filters**: Verifying if GPU acceleration is required.
  - **Memory Limits**: Sizing available RAM against deployment criteria.
  - **Least Load Scheduling**: Placing the replica container on the qualified node with the lowest current CPU load.
* **Scale-To-Zero Monitor**: Evaluates idle deployments. If an agent receives no traffic within its configured `idleTimeout` and has `minReplicas: 0`, the scheduler scales it down to zero to free host memory.

### 3. Workflow Pipeline Engine
* **Execution Sequencer**: Automates step-by-step orchestrations of multi-agent tasks. It registers blueprints (e.g., passing data from a calculator agent to a weather agent).
* **Data Context Interpolation**: Steps can parameterize arguments dynamically by interpolating outputs from previous steps using the standard bracket syntax:
  - `{{input.value}}` maps global pipeline inputs.
  - `{{steps.stepname.output.field}}` resolves fields from a previous step's final JSON result.

### 4. Secrets Management
* **Namespace Isolation**: Secures agent configuration variables (like API keys) in a dedicated registry isolated by agent namespaces.
* **Environment Injection**: Secrets are dynamically loaded and injected into subprocess runtimes upon initialization.

### 5. State Store
* **Persistence & Cache**: Emulates database and cache persistence for agents using a simulated Redis memory layer and local PostgreSQL storage integration, facilitating persistent chat histories and state records.

### 6. Event Bus
* **Asynchronous Pub/Sub**: Enables agents to run asynchronously by publishing events to topic channels and subscribing to topics, facilitating event-driven architectures.

### 7. Observability & Costs Tracker
* **Compute Auditing**: Collects metrics (CPU usage, memory allocation, replica counts) and logs billing details. It tallies simulated compute costs based on active running seconds and token operations.

---

## Configuration Specification (`agent.yaml`)

Place an `agent.yaml` configuration in your agent's source directory:

```yaml
# Unique identifier of the agent deployment
name: weather-agent

# Working directory where the start command will execute (relative to this file)
dir: .

# Program or shell script to spin up the agent server
command: npm start

# Target number of running replicas when deployed
replicas: 1

# Scaling boundaries (set minReplicas to 0 for scale-to-zero)
minReplicas: 0
maxReplicas: 3

# Duration of inactivity before scale-to-zero is triggered (e.g. 30s, 5m)
idleTimeout: 30s

# Hardware and region constraints for node scheduling
placement:
  region: us-east-1
  gpu: false
  memory: 512Mi

# Environment variables injected into the agent runtime
env:
  - name: NODE_ENV
    value: "production"
```

---

## Quick Start Guide

### 1. Build and Run the Orchestrator
Compile and start the Go server from the `apps/agent-infra` directory:
```powershell
# Compile Go binary
go build -o agentos.exe

# Start orchestrator
.\agentos.exe run
```
The gateway, proxy, and dashboard will boot and listen at `http://localhost:8080`.

### 2. Deploy an Agent
Submit a deployment request pointing to an `agent.yaml` file path:
```bash
.\agentos.exe deploy .\example\weather\agent.yaml
```

---


### CLI commands

Keep agentos run open in one terminal and use the client commands from another:

~~~powershell
./agentos.exe status
./agentos.exe agents
./agentos.exe stats
./agentos.exe stats weather-agent
./agentos.exe logs weather-agent
./agentos.exe scale weather-agent 2
./agentos.exe undeploy weather-agent
~~~

Use --server http://host:port (or AGENTOS_SERVER) to target another running
instance. agentos run also accepts manifests and deploys them at startup:

~~~powershell
./agentos.exe run ./example/weather/agent.yaml
~~~

Run agentos help for explanations and the complete command reference.

## API & Usage References

### 1. Deploy Agent
* **Endpoint**: `POST /api/deploy`
* **Payload**: `{"path": "./example/weather/agent.yaml"}`

### 2. Retrieve Running Deployments
* **Endpoint**: `GET /api/agents`
* **Response Sample**:
```json
[
  {
    "name": "weather-agent",
    "command": "npm start",
    "resolved_dir": "C:\\Users\\Anish\\Documents\\building\\23-inqora\\apps\\agent-infra\\example\\weather",
    "desired_replicas": 1,
    "min_replicas": 0,
    "max_replicas": 3,
    "idle_timeout": "30s",
    "instances": [
      {
        "id": "16bb84db-f11e-401a-b242-5624db4f262f",
        "port": 10000,
        "status": "HEALTHY",
        "started_at": "2026-06-16T18:00:00Z"
      }
    ]
  }
]
```

### 3. Call Agent via Proxy (Load Balanced)
* **Endpoint**: `GET /proxy/:agent_name/:subpath`
* **Example**:
```bash
curl.exe "http://localhost:8080/proxy/weather-agent/invoke?city=Seattle"
```

### 4. Asynchronous Job Queue API
* **Submit Task**: `POST /api/agents/:agent_name/jobs`
  - Body: `{"city": "Paris"}`
  - Returns: `{"status":"success","message":"Job enqueued","job_id":"<uuid>"}`
* **Poll Task Result**: `GET /api/jobs/:id`
  - Returns:
  ```json
  {
    "id": "98d9c9d7-5236-4b10-adae-a317d0616f47",
    "agent_name": "weather-agent",
    "input": {"city": "Paris"},
    "output": {"response": "dummy response"},
    "status": "COMPLETED",
    "created_at": "2026-06-16T18:00:00Z",
    "finished_at": "2026-06-16T18:00:05Z"
  }
  ```

### 5. Fetch Agent Logs
* **Endpoint**: `GET /api/agents/:agent_name/logs`
* **Description**: Returns consolidated log streams of stdout/stderr for both active running instances and the last 5 terminated history instances.

### 6. Manual Scale Replicas
* **Endpoint**: `POST /api/agents/:agent_name/scale`
* **Payload**: `{"replicas": 2}`

### 7. Undeploy Agent
* **Endpoint**: `DELETE /api/deploy/:agent_name`

### 8. List Cluster Nodes
* **Endpoint**: `GET /api/nodes`

### 9. Manage Secrets
* **Endpoint**: `POST /api/secrets`
* **Payload**: `{"namespace": "weather-agent", "key": "GEMINI_API_KEY", "value": "xyz"}`

### 10. List Marketplace templates
* **Endpoint**: `GET /api/marketplace`

