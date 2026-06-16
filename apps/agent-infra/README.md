# AgentOS Orchestrator

AgentOS is a production-grade, lightweight Kubernetes-like orchestrator for AI agents written in Go. It manages agent deployments, handles dynamic port allocation, reverse-proxies and load-balances incoming traffic, implements scale-to-zero autoscaling, and processes long-running agent tasks via an internal background job queue.

It is designed to support agents built in different frameworks (e.g. LangChain, CrewAI, LangGraph) by running them as sandboxed service microservices that communicate over HTTP.

---

## Architecture Diagram

```
                 +--------------------------------------------+
                 |            Control Plane Gateway           |
                 |               (Port 8080)                  |
                 +-----+-------------------+------------+-----+
                       |                   |            |
     [HTTP Proxy]      |    [Control API]  |            |  [Job API]
                       v                   v            v
+----------------------+--+  +-------------+--+  +------+------+
|   Reverse Proxy &    |  |  |  Scheduler   |  |  |  Job Queue  |
|    Load Balancer     |  |  | Controller   |  |  |   & Workers |
+----------+-----------+  |  +------+-------+  |  +-----+------+
           |              |         |          |        |
           | (routes)     |         | (scales) |        | (invokes)
           |              |         v          |        |
           |              |  +------+-------+  |        |
           |              |  | Port Pool    |  |        |
           |              |  | (10000-11000)|  |        |
           |              |  +--------------+  |        |
           |              v                    v        |
           |       +------+--------------------+-----+  |
           +------>|         Agent Worker Fleet        |<-+
                   |  (weather-agent, research, etc.) |
                   +---------------------------------+
```

---

## Key Features

1. **Declarative Deployments**: Define agent metadata, commands, min/max scaling policies, and custom environment variables in a single `agent.yaml` file.
2. **Dynamic Port Allocation**: Orchestrator dynamically manages a pool of ports (`10000-11000`) and passes the assigned port to the agent process via the `PORT` environment variable.
3. **Autoscaling (Scale-to-Zero)**: Scale down idle agents automatically to save memory, and bring them back up instantly on-demand ("cold start") when traffic arrives.
4. **Historical Log Retention**: Preserves a sliding window of the last 5 terminated instances' console logs to prevent diagnostics loss on scale-down or crash events.
5. **Reverse Proxy Load Balancing**: Round-robins incoming traffic over healthy replicas under `/proxy/:agent_name/*`.
6. **Async Job Queue**: Submit long-running tasks asynchronously, allowing workers to execute the agent and store outputs for polling.
7. **Trapped Graceful Shutdown**: Automatically catches interrupt signals (`SIGINT`, `SIGTERM`) and cleans up the child processes recursively (including Windows child process trees).

---

## Configuration Spec (`agent.yaml`)

Place an `agent.yaml` in your agent's directory:

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

# Environment variables injected into the agent runtime
env:
  - name: GEMINI_API_KEY
    value: "your-gemini-api-key"
  - name: NODE_ENV
    value: "production"
```

---

## Quick Start Guide

### 1. Build and Run the Orchestrator

Compile and start the Go server:
```bash
# Compile Go binary
go build -o ai-infra.exe

# Start orchestrator
./ai-infra.exe
```
The control plane and reverse proxy will start listening at `http://localhost:8080`.

### 2. Deploy an Agent
Submit a deployment request pointing to your `agent.yaml` path:

```bash
curl.exe -X POST -H "Content-Type: application/json" -d '{"path": "./example/weather/agent.yaml"}' http://localhost:8080/api/deploy
```

---

## API & Usage References

### 1. Retrieve Running Agent Deployments
List all registered deployments, their current desired states, and statuses of all running replicas:

```bash
curl.exe http://localhost:8080/api/agents
```
**Response Sample**:
```json
[
  {
    "name": "weather-agent",
    "command": "npm start",
    "resolved_dir": "C:\\Users\\Anish\\Documents\\building\\23-inqora\\apps\\agent-infra\\example",
    "desired_replicas": 1,
    "min_replicas": 0,
    "max_replicas": 3,
    "idle_timeout": "30s",
    "last_traffic_time": "2026-06-15T22:38:12+05:30",
    "instances": [
      {
        "id": "16bb84db-f11e-401a-b242-5624db4f262f",
        "port": 10000,
        "status": "HEALTHY",
        "started_at": "2026-06-15T22:37:49+05:30"
      }
    ]
  }
]
```

### 2. Call the Agent via Reverse Proxy (Load Balanced)
Send requests directly through the orchestrator. If the agent is scaled to 0, it will boot the agent, block until the agent is healthy, and route the request:

```bash
curl.exe "http://localhost:8080/proxy/weather-agent/invoke?city=Seattle"
```

### 3. Asynchronous Job Queue API
For long-running tasks, submit them to the queue and poll for completion:

* **Submit Task**:
  ```bash
  curl.exe -X POST -H "Content-Type: application/json" -d '{"city": "Paris"}' http://localhost:8080/api/agents/weather-agent/jobs
  ```
  Returns: `{"status":"success","message":"Job enqueued","job_id":"<job_id>"}`

* **Poll Task Result**:
  ```bash
  curl.exe http://localhost:8080/api/jobs/<job_id>
  ```
  Response:
  ```json
  {
    "id": "98d9c9d7-5236-4b10-adae-a317d0616f47",
    "agent_name": "weather-agent",
    "input": {"city": "Paris"},
    "output": {"response": "dummy response"},
    "status": "COMPLETED",
    "created_at": "2026-06-15T22:38:12+05:30",
    "finished_at": "2026-06-15T22:38:12+05:30"
  }
  ```

### 4. Fetch Agent Logs (Active & Historical)
Retrieve consolidated logs from all active running replicas and the last 5 terminated replicas:

```bash
curl.exe http://localhost:8080/api/agents/weather-agent/logs
```

### 5. Manual Scale Up/Down
Override replicas configuration manually:

```bash
curl.exe -X POST -H "Content-Type: application/json" -d '{"replicas": 2}' http://localhost:8080/api/agents/weather-agent/scale
```

### 6. Undeploy Agent
Undeploy the agent, terminating all replicas and freeing allocated ports:

```bash
curl.exe -X DELETE http://localhost:8080/api/deploy/weather-agent
```